// src/stores/OtaStore.js
import { create } from "zustand";

/**
 * OTA 업데이트 상태 관리 스토어
 */
export const useOtaStore = create((set, get) => ({
  // 전역 상태
  isUpdating: false, // 업데이트 진행 중 (전체)
  
  // 로컬 인덱스
  localIndex: null, // 로컬 index.json 데이터
  
  // 기기별 상태
  deviceStatus: {}, // { deviceId: { checking, hasUpdate, updateCount, error } }
  deviceVersions: {}, // { deviceId: { entry_count, entries: [...] } }
  availableUpdates: {}, // { deviceId: [{ sw_id, currentVersion, ... }] }
  updateProgress: {}, // { deviceId: { status, message, progress, transactionId } }

  /**
   * 로컬 index.json 로드
   */
  loadLocalIndex: (indexData) => {
    set({ localIndex: indexData });
  },

  /**
   * 기기 상태 설정
   */
  setDeviceStatus: (deviceId, status) => {
    set((state) => ({
      deviceStatus: {
        ...state.deviceStatus,
        [deviceId]: {
          ...state.deviceStatus[deviceId],
          ...status,
        },
      },
    }));
  },

  /**
   * 기기 버전 정보 설정
   */
  setDeviceVersions: (deviceId, versions) => {
    set((state) => ({
      deviceVersions: {
        ...state.deviceVersions,
        [deviceId]: versions,
      },
    }));
  },

  /**
   * 업데이트 가능 항목 설정
   */
  setAvailableUpdates: (deviceId, updates) => {
    set((state) => ({
      availableUpdates: {
        ...state.availableUpdates,
        [deviceId]: updates,
      },
    }));
  },

  /**
   * 업데이트 진행 상태 설정
   */
  setUpdateProgress: (deviceId, progress) => {
    set((state) => ({
      updateProgress: {
        ...state.updateProgress,
        [deviceId]: progress,
      },
    }));
  },

  /**
   * 업데이트 시작
   */
  startUpdating: (deviceId) => {
    set({ isUpdating: true });
    get().setUpdateProgress(deviceId, {
      status: "preparing",
      message: "업데이트 준비 중...",
      progress: 0,
    });
  },

  /**
   * 업데이트 종료
   */
  stopUpdating: () => {
    set({ isUpdating: false });
  },

  /**
   * 특정 기기 상태 초기화
   */
  clearDeviceState: (deviceId) => {
    set((state) => {
      const newDeviceStatus = { ...state.deviceStatus };
      const newDeviceVersions = { ...state.deviceVersions };
      const newAvailableUpdates = { ...state.availableUpdates };
      const newUpdateProgress = { ...state.updateProgress };

      delete newDeviceStatus[deviceId];
      delete newDeviceVersions[deviceId];
      delete newAvailableUpdates[deviceId];
      delete newUpdateProgress[deviceId];

      return {
        deviceStatus: newDeviceStatus,
        deviceVersions: newDeviceVersions,
        availableUpdates: newAvailableUpdates,
        updateProgress: newUpdateProgress,
      };
    });
  },

  /**
   * 전체 초기화
   */
  reset: () => {
    set({
      isUpdating: false,
      deviceStatus: {},
      deviceVersions: {},
      availableUpdates: {},
      updateProgress: {},
    });
  },

  /**
   * 특정 기기의 업데이트 가능 여부 확인
   */
  hasUpdates: (deviceId) => {
    const status = get().deviceStatus[deviceId];
    return status?.hasUpdate === true;
  },

  /**
   * 특정 기기의 체크 진행 여부 확인
   */
  isChecking: (deviceId) => {
    const status = get().deviceStatus[deviceId];
    return status?.checking === true;
  },

  /**
   * 특정 기기의 업데이트 개수 조회
   */
  getUpdateCount: (deviceId) => {
    const updates = get().availableUpdates[deviceId];
    return updates?.length || 0;
  },
}));