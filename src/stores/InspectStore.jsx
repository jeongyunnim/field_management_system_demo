// src/stores/InspectStore.js
import { create } from "zustand";

export const useInspectStore = create((set) => ({
  phase: "idle", // "idle: 점검 가능(유휴 상태)" | "requesting: 점검 요청 신호" | "running: 점검 중" | "stopping: 점검 중단 요청"
  setPhase: (p) => set({ phase: p }),
  startedAt: null,
  setStartedAt: (p) => set({ startedAt: p }),
}));