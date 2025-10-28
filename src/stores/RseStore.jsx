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
  
  // ⭐ 등록 여부 맵
  registrationById: {},
  
  // Stale 임계값 (초)
  staleSec: 3,
  
  // Stale 감시 타이머 (내부용)
  __staleTimerId: null,

  // ==================== Stale 감시 ====================
  
  setStaleThreshold: (sec) => 
    set({ staleSec: Math.max(1, Number(sec) || 3) }),

  startStaleWatcher: (staleSec, intervalMs = 1000) => {
    const state = get();
    
    if (state.__staleTimerId) {
      console.warn("Stale watcher already running");
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

  // ==================== 셀렉터 ====================

  selectAll: () => Object.values(get().byId),

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

  clear: () => set({ byId: {}, warningById: {}, registrationById: {} }),

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
   * ⭐ 미등록 장치 삽입 (최소 정보만)
   * @param {string} id - 장치 ID
   * @param {string} serial - 시리얼 번호
   * @param {object} raw - 원본 패킷 데이터
   */
  upsertUnregisteredDevice: (id, serial, raw) => {
    const now = Date.now();
    
    const unregisteredDevice = {
      id,
      serial,
      isRegistered: false,  // ⭐ 미등록
      active: true,
      health: null,         // 헬스 정보 없음
      securityWarnings: [], // 경고 없음
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
   * ⭐ 등록된 장치 업데이트 (전체 파싱)
   * @param {string} id - 장치 ID
   * @param {string} serial - 시리얼 번호
   * @param {object} raw - 원본 패킷 데이터
   */
  upsertRseStatus: (id, serial, raw) => {
    // 패킷 파싱
    const normalized = parseRsePacket(raw);
    if (!normalized) {
      console.warn(`Failed to parse RSE packet for ${id}`);
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
    
    // ⭐ 보안/인증 경고 감지
    const securityWarnings = detectSecurityWarnings(raw, healthSummary);

    // 새 상태 생성
    const updated = {
      id,
      serial,
      ...normalized,
      health: healthSummary,
      isRegistered: true,  // ⭐ 등록됨
      securityWarnings,    // ⭐ 보안 경고
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
    console.log("Watcher running:", !!state.__staleTimerId);
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