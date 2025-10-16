// src/stores/InspectStore.js
// src/stores/InspectStore.js
import { create } from "zustand";

export const useInspectStore = create((set) => ({
  phase: "idle", // "idle" | "requesting" | "running" | "stopping"
  setPhase: (p) => set({ phase: p }),
}));