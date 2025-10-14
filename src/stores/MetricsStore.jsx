// src/stores/MetricsStore.jsx
import { create } from "zustand";

const MAX_LEN = 180; // 3분치 등 상황에 맞게

function pushKeep(arr, v, maxLen = MAX_LEN) {
  if (v == null || !isFinite(v)) return arr;
  const next = arr.length >= maxLen ? arr.slice(arr.length - maxLen + 1) : arr.slice();
  next.push(Number(v));
  return next;
}

export const useMetricsStore = create((set, get) => ({
  selectedId: null,                           // 현재 선택된 시리얼
  seriesById: Object.create(null),            // { [serial]: { cpu:[], emmc:[], ram:[] } }
  latestById: Object.create(null),            // { [serial]: { cpu, emmc, ram, updatedAt } }
  warningById: {},
  setSelected: (id) => set({ selectedId: id }),
  setWarning: (id, isWarn) =>
        set((s) => {
          const prev = !!s.warningById[id];
          const next = !!isWarn;
          if (prev === next) return {};               // 변화 없으면 리렌더 생략
          return { warningById: { ...s.warningById, [id]: next } };
        }),
  // RSE 변환 item을 받아 시리즈 업데이트
  pushFromItem: (item) => {
    const id = item?.id;
    if (!id) return;
    const { cpuTotalPct, diskUsedPct, memUsedPct } = item;

    const byId = { ...get().seriesById };
    const row = byId[id] || { cpu: [], emmc: [], ram: [] };

    byId[id] = {
      cpu:  pushKeep(row.cpu,  cpuTotalPct),
      emmc: pushKeep(row.emmc, diskUsedPct),  // eMMC = 디스크 사용률
      ram:  pushKeep(row.ram,  memUsedPct),
    };

    const latest = { ...get().latestById };
    latest[id] = {
      cpu:  Number.isFinite(cpuTotalPct) ? cpuTotalPct : null,
      emmc: Number.isFinite(diskUsedPct) ? diskUsedPct : null,
      ram:  Number.isFinite(memUsedPct) ? memUsedPct : null,
      updatedAt: Date.now(),
    };
    
    set({ seriesById: byId, latestById: latest });
  },
}));
