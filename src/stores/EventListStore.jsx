import { create } from "zustand";

const MAX_LOGS = 2000;

export const useEventLogStore = create((set, get) => ({
  items: [],
  filters: {
    level: new Set(["INFO", "WARN", "ERROR"]),
    source: new Set(["APP", "MQTT", "BUS", "DIRECT", "FMS", "RSE"]),
    search: "",
  },
  push(entry) {
    const state = get();
    const items = state.items.length >= MAX_LOGS
      ? [...state.items.slice(-Math.floor(MAX_LOGS * 0.9)), entry] // 약 10% 슬라이딩 윈도우
      : [...state.items, entry];
    set({ items });
  },
  clear() { set({ items: [] }); },
  setFilter(partial) {
    const next = { ...get().filters, ...partial };
    set({ filters: next });
  },
  exportCsv() {
    const rows = [["ts", "level", "source", "entity", "event", "message"]];
    for (const it of get().items) {
      rows.push([
        new Date(it.ts).toISOString(),
        it.level, it.source, it.entity ?? "",
        it.event ?? "", it.message ?? "",
      ]);
    }
    const csv = rows.map(r =>
      r.map(v => String(v).replace(/"/g, '""')).map(v => `"${v}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `event_logs_${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
}));
