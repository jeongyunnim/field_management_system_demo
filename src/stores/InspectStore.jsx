// src/stores/InspectStore.jsx
import { create } from "zustand";

export const useInspectStore = create((set, get) => ({
  // 점검 단계
  phase: "idle", // "idle: 점검 가능(유휴 상태)" | "requesting: 점검 요청 신호" | "running: 점검 중" | "stopping: 점검 중단 요청"
  setPhase: (p) => set({ phase: p }),
  
  // 점검 시작 시간
  startedAt: null,
  setStartedAt: (p) => set({ startedAt: p }),
  
  // 에러 상태
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  // 재시도 횟수
  retryCount: 0,
  incrementRetry: () => set((state) => ({ retryCount: state.retryCount + 1 })),
  resetRetry: () => set({ retryCount: 0 }),
  
  // 유틸리티: 점검 진행 시간 (밀리초)
  getElapsedTime: () => {
    const { startedAt } = get();
    if (!startedAt) return 0;
    return Date.now() - startedAt;
  },
  
  // 유틸리티: 점검 진행 여부
  isInspecting: () => {
    const { phase } = get();
    return phase === "running" || phase === "requesting" || phase === "stopping";
  },
  
  // 유틸리티: 점검 가능 여부
  canStartInspection: () => {
    const { phase } = get();
    return phase === "idle";
  },
  
  // 초기화
  reset: () => set({
    phase: "idle",
    startedAt: null,
    error: null,
    retryCount: 0,
  }),
}));