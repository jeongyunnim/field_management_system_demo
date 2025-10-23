import { useMemo, useRef, useEffect } from "react";
import { useEventLogStore } from "../stores/EventListStore";
import { Card } from "./common/Card";

const levelClass = {
  INFO: "text-slate-200",
  WARN: "text-amber-300",
  ERROR: "text-red-300",
};

// YYYYMMDD HH:mm:ss.SSS
const fmtTs = (ts) => {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return String(ts);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${M}${D} ${h}:${m}:${s}`;
};

export default function EventLogPanel() {
  const { items, paused, filters, setPaused, setFilter, clear, exportCsv } = useEventLogStore();
  const listRef = useRef(null);

  const view = useMemo(() => {
    const q = (filters.search || "").toLowerCase();
    return items.filter(it => {
      if (!filters.level.has(it.level)) return false;
      if (!filters.source.has(it.source)) return false;
      if (!q) return true;
      const hay = [
        new Date(it.ts).toISOString(), it.level, it.source, it.entity ?? "",
        it.event ?? "", it.message ?? ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, filters]);

  useEffect(() => {
    if (paused) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view, paused]);

  const toggleSet = (set, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  };

  return (
    <Card className="justify-between">
      <div className="flex items-center justify-between mb-2">
        <h2 className="main-card-title">이벤트 리스트 로그</h2>
      </div>

      <div className="bg-[#2E3A4E] rounded-xl border border-slate-100 p-0 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="px-3 py-2 border-b border-slate-600/50 flex items-start gap-2">
          <div className="flex justify-start gap-2">
            {["INFO","WARN","ERROR"].map(lv => (
              <button
                key={lv}
                onClick={() => setFilter({ level: toggleSet(filters.level, lv) })}
                className={`px-2 py-1 rounded text-xs border ${filters.level.has(lv) ? "bg-slate-600 border-slate-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                title={`Toggle ${lv}`}
              >{lv}</button>
            ))} 
            <input
              className="px-2 py-1 text-xs rounded grow bg-slate-800 border border-slate-700 text-slate-200"
              placeholder="검색.."
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              style={{ width: 180 }}
            />
            <button onClick={exportCsv} className="px-2 py-1 text-xs rounded bg-slate-700 text-white border border-slate-500">CSV</button>
            <button onClick={clear} className="px-2 py-1 text-xs rounded bg-slate-600 text-slate-300 border border-slate-600">Clear</button>
          </div>
        </div>

        {/* List: 동일 폰트 크기, 간격 제거, 더 긴 높이 + 스크롤 */}
        <div
          ref={listRef}
          className="flex-1 justify-end overflow-y-auto text-sm min-h-[37rem] max-h-[37rem]"  // 높이 ↑
        >
          {view.map((it, idx) => (
            <div key={idx} className="px-3 py-1 border-b border-slate-700/40"> {/* 간격 최소화 */}
              {/* [ts][level][source][event]: message  (모든 섹션 text-sm로 통일, gap 제거) */}
              <div className="whitespace-pre-wrap text-sm leading-5"> {/* 한 줄 높이도 촘촘히 */}
                <span className="font-mono align-middle">
                  {"["}{fmtTs(it.ts)}{"]"}
                </span>
                <span className={`align-middle ${levelClass[it.level] || "text-slate-200"}`}>
                  {"["}{it.level}{"]"}
                </span>
                <span className="text-slate-300 align-middle">
                  {"["}{it.source}{"]"}
                </span>
                <span className="text-slate-100 align-middle">
                  {"["}{it.event}{"]"}{it.message ? `: ${it.message}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
