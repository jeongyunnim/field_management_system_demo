// src/stores/RseStore.jsx
import { create } from "zustand";
import { parseRsePacket } from "../utils/parseRse";
import { computeHealthSummary, detectSecurityWarnings } from "../utils/transformRse";

/**
 * 유틸리티 함수들
 */
const isFiniteNum = (value) => typeof value === "number" && Number.isFinite(value);

const hasValidCoordinates = (gnss) => 
  isFiniteNum(gnss?.lat) && isFiniteNum(gnss?.lon);

/**
 * RSE(Roadside Equipment) 상태 관리 스토어
 */
export const useRseStore = create((set, get) => ({
  // ==================== 상태 ====================
  
  // RSE 장치 목록 (ID로 인덱싱)
  byId: {},
  
  // 경고 상태 맵
  warningById: {},
  
  // 등록 여부 맵
  registrationById: {},
  
  // Stale 임계값 (초)
  staleSec: 3,
  
  // Stale 감시 타이머
  __staleTimerId: null,
  
  // 🆕 재검증 타이머 (DB 동기화용)
  __revalidateTimerId: null,

  // ==================== Stale 감시 ====================
  
  setStaleThreshold: (sec) => 
    set({ staleSec: Math.max(1, Number(sec) || 3) }),

  startStaleWatcher: (staleSec, intervalMs = 1000) => {
    const state = get();
    
    if (state.__staleTimerId) {
      console.warn("[RseStore] Stale watcher already running");
      return;
    }

    if (Number.isFinite(staleSec)) {
      set({ staleSec });
    }

    const timer = setInterval(() => {
      const { byId, staleSec } = get();
      const now = Date.now();
      let hasChanges = false;
      const updatedById = { ...byId };

      for (const [id, device] of Object.entries(byId)) {
        const lastReceived = device?.__receivedAt ?? device?._ts ?? 0;
        const elapsedSec = (now - lastReceived) / 1000;
        const shouldBeActive = elapsedSec <= staleSec;

        if (!!device?.active !== shouldBeActive) {
          updatedById[id] = { ...device, active: shouldBeActive };
          hasChanges = true;
        }
      }

      if (hasChanges) {
        set({ byId: updatedById });
      }
    }, intervalMs);

    set({ __staleTimerId: timer });
  },

  stopStaleWatcher: () => {
    const { __staleTimerId } = get();
    
    if (__staleTimerId) {
      clearInterval(__staleTimerId);
      set({ __staleTimerId: null });
    }
  },

  // ==================== 🆕 재검증 (DB 동기화) ====================
  
  /**
   * 🆕 재검증 타이머 시작 - 미등록 장치를 주기적으로 확인
   */
  startRevalidation: (intervalMs = 5000) => {
    const state = get();
    
    if (state.__revalidateTimerId) {
      console.warn("[RseStore] Revalidation already running");
      return;
    }

    const timer = setInterval(async () => {
      await get().revalidateUnregistered();
    }, intervalMs);

    set({ __revalidateTimerId: timer });
    console.log(`[RseStore] Revalidation started (every ${intervalMs}ms)`);
  },

  /**
   * 🆕 재검증 타이머 중지
   */
  stopRevalidation: () => {
    const { __revalidateTimerId } = get();
    
    if (__revalidateTimerId) {
      clearInterval(__revalidateTimerId);
      set({ __revalidateTimerId: null });
      console.log("[RseStore] Revalidation stopped");
    }
  },

  /**
   * 🆕 미등록 장치들의 등록 상태 재확인 및 마이그레이션
   */
  revalidateUnregistered: async () => {
    const { byId } = get();
    
    // unregistered_로 시작하는 장치만 필터링
    const unregisteredDevices = Object.entries(byId).filter(
      ([id]) => id.startsWith('unregistered_')
    );

    if (unregisteredDevices.length === 0) return;

    console.log(`[RseStore] Checking ${unregisteredDevices.length} unregistered device(s)...`);

    // 동적 import (순환 참조 방지)
    const { isDeviceRegistered, getDeviceIdBySerial } = await import('../dbms/deviceDb');

    for (const [unregisteredId, device] of unregisteredDevices) {
      try {
        const serial = device.serial;
        const isRegistered = await isDeviceRegistered(serial);

        if (isRegistered) {
          // DB에 등록됨! canonical ID 가져오기
          const canonicalId = await getDeviceIdBySerial(serial);
          
          if (canonicalId) {
            // 미등록 → 등록 마이그레이션
            console.log(`[RseStore] Device registered: ${serial} (${unregisteredId} → ${canonicalId})`);
            
            // 1. 기존 미등록 장치 삭제
            get().removeById(unregisteredId);
            
            // 2. 등록된 장치로 재삽입 (전체 파싱)
            if (device.__raw) {
              get().upsertRseStatus(canonicalId, serial, device.__raw);
            }
          }
        }
      } catch (error) {
        console.error(`[RseStore] Revalidation error for ${unregisteredId}:`, error);
      }
    }
  },

  /**
   * 🆕 수동 재검증 트리거 (DB 업데이트 직후 호출)
   */
  triggerRevalidation: async () => {
    console.log("[RseStore] Manual revalidation triggered");
    await get().revalidateUnregistered();
  },

  // ==================== 셀렉터 ====================

  selectAll: () => Object.values(get().byId),
  
  // 🆕 등록된 장치만 선택
  selectRegistered: () =>
    Object.values(get().byId).filter((device) => device?.isRegistered === true),
  
  // 🆕 미등록 장치만 선택
  selectUnregistered: () =>
    Object.values(get().byId).filter((device) => device?.isRegistered === false),

  selectAllWithFix: () =>
    Object.values(get().byId).filter((device) => 
      hasValidCoordinates(device?.gnss)
    ),

  selectBounds: () => {
    const coordinates = Object.values(get().byId)
      .map((device) => device?.gnss)
      .filter((gnss) => hasValidCoordinates(gnss))
      .map((gnss) => [gnss.lat, gnss.lon]);

    if (coordinates.length === 0) return null;

    let south = coordinates[0][0];
    let north = coordinates[0][0];
    let west = coordinates[0][1];
    let east = coordinates[0][1];

    for (let i = 1; i < coordinates.length; i++) {
      const [lat, lon] = coordinates[i];
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
    }

    return [[south, west], [north, east]];
  },

  selectById: (id) => (id ? get().byId[id] ?? null : null),

  selectActiveCount: () =>
    Object.values(get().byId).filter((device) => device?.active).length,

  selectWarningCount: () =>
    Object.values(get().warningById).filter((isWarning) => isWarning).length,

  // ==================== 뮤테이션 ====================

  removeById: (id) =>
    set((state) => {
      const nextById = { ...state.byId };
      const nextWarningById = { ...state.warningById };
      const nextRegistrationById = { ...state.registrationById };
      
      delete nextById[id];
      delete nextWarningById[id];
      delete nextRegistrationById[id];
      
      return { 
        byId: nextById, 
        warningById: nextWarningById,
        registrationById: nextRegistrationById
      };
    }),

  clear: () => {
    set({ byId: {}, warningById: {}, registrationById: {} });
    console.log("[RseStore] Store cleared");
  },

  setWarning: (id, isWarning) =>
    set((state) => {
      const currentWarning = !!state.warningById[id];
      const nextWarning = !!isWarning;

      if (currentWarning === nextWarning) return {};

      return { 
        warningById: { 
          ...state.warningById, 
          [id]: nextWarning 
        } 
      };
    }),

  /**
   * 미등록 장치 삽입 (최소 정보만)
   */
  upsertUnregisteredDevice: (id, serial, raw) => {
    const now = Date.now();
    
    const unregisteredDevice = {
      id,
      serial,
      isRegistered: false,
      active: true,
      health: null,
      securityWarnings: [],
      _ts: now,
      __raw: raw,
      __receivedAt: now,
    };

    set((state) => ({ 
      byId: { 
        ...state.byId, 
        [id]: unregisteredDevice 
      },
      registrationById: {
        ...state.registrationById,
        [id]: false
      }
    }));

    console.debug(`[RseStore] Unregistered device added: ${id} (${serial})`);
  },

  /**
   * 등록된 장치 업데이트 (전체 파싱)
   */
  upsertRseStatus: (id, serial, raw) => {
    // 패킷 파싱
    const normalized = parseRsePacket(raw);
    if (!normalized) {
      console.warn(`[RseStore] Failed to parse RSE packet for ${id}`);
      return;
    }

    const previous = get().byId[id];
    const now = Date.now();

    // 메시지 수신률 계산
    const currentRxTotal = Number(normalized?.rseStatus?.rxTotal ?? 0);
    const previousRxTotal = Number(previous?.rseStatus?.rxTotal ?? 0);
    const deltaTime = previous ? Math.max(1, (now - previous._ts) / 1000) : 1;
    const deltaRx = currentRxTotal - previousRxTotal;
    const messagesPerSecond = deltaRx >= 0 ? deltaRx / deltaTime : 0;

    // 헬스 체크
    const healthSummary = computeHealthSummary(raw);
    
    // 보안/인증 경고 감지
    const securityWarnings = detectSecurityWarnings(raw, healthSummary);

    // 새 상태 생성
    const updated = {
      id,
      serial,
      ...normalized,
      health: healthSummary,
      isRegistered: true,
      securityWarnings,
      active: true,
      msgPerSec: Number(messagesPerSecond.toFixed(1)),
      _ts: now,
      __raw: raw,
      __receivedAt: now,
    };

    // 변경 감지 (불필요한 업데이트 방지)
    const hasChanges = !previous || 
      previous.rseStatus?.rxTotal !== updated.rseStatus?.rxTotal ||
      previous.rseStatus?.txTotal !== updated.rseStatus?.txTotal ||
      previous.rseStatus?.txReady !== updated.rseStatus?.txReady ||
      previous.gnss?.lat !== updated.gnss?.lat ||
      previous.gnss?.lon !== updated.gnss?.lon ||
      previous.gnss?.heading_deg !== updated.gnss?.heading_deg ||
      previous.health?.pct !== updated.health?.pct;

    // 변경사항이 있을 때만 업데이트
    if (hasChanges) {
      set((state) => ({ 
        byId: { 
          ...state.byId, 
          [id]: updated 
        },
        registrationById: {
          ...state.registrationById,
          [id]: true
        }
      }));
    }
  },

  // ==================== 유틸리티 ====================

  debug: () => {
    const state = get();
    console.log("=== RSE Store Debug ===");
    console.log("Total devices:", Object.keys(state.byId).length);
    console.log("Registered:", Object.values(state.registrationById).filter(r => r).length);
    console.log("Unregistered:", Object.values(state.registrationById).filter(r => !r).length);
    console.log("Active devices:", state.selectActiveCount());
    console.log("Warning devices:", state.selectWarningCount());
    console.log("Stale threshold:", state.staleSec, "seconds");
    console.log("Stale watcher:", !!state.__staleTimerId ? "RUNNING" : "STOPPED");
    console.log("Revalidation:", !!state.__revalidateTimerId ? "RUNNING" : "STOPPED"); // 🆕
    console.log("======================");
  },

  getStatistics: () => {
    const state = get();
    const devices = Object.values(state.byId);
    
    return {
      total: devices.length,
      registered: devices.filter((d) => d?.isRegistered === true).length,
      unregistered: devices.filter((d) => d?.isRegistered === false).length,
      active: devices.filter((d) => d?.active).length,
      inactive: devices.filter((d) => !d?.active).length,
      withCoordinates: devices.filter((d) => hasValidCoordinates(d?.gnss)).length,
      withWarnings: Object.values(state.warningById).filter((w) => w).length,
    };
  },
}));

// ==================== 외부 헬퍼 함수 ====================

export function isDeviceActive(device, staleSec = 3) {
  if (!device) return false;
  const lastReceived = device.__receivedAt ?? device._ts ?? 0;
  const elapsedSec = (Date.now() - lastReceived) / 1000;
  return elapsedSec <= staleSec;
}

export function isDeviceHealthy(device) {
  if (!device?.health) return false;
  const healthPct = typeof device.health === "object"
    ? Number(device.health.healthPct ?? device.health.pct ?? 0)
    : Number(device.health);
  return healthPct === 100;
}