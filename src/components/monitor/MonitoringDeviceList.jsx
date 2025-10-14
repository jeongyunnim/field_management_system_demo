// src/components/MonitoringDeviceList.jsx
import { useEffect, useMemo, useRef, useState, useCallback} from "react";
import Donut, { healthColorForPct } from "../common/Donut";
import Led from "../common/Led";
import SignalBars from "../common/SignalBars";
import { rssiToBars } from "../../utils/signal";
import { Card } from "../common/Card";

export default function MonitoringDeviceList({
  onStatusUpdate,
  onSelect,
  selectedId,
  className = "",
}) {
  const [items, setItems] = useState([]);
  const timerRef = useRef(null);

  const upsertItem = useCallback((next) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === next.id);
      if (i === -1) {
        return [next, ...prev]; // 새로운 장비는 맨 앞에
      }
      // 기존은 병합 갱신
      const copy = prev.slice();
      copy[i] = { ...copy[i], ...next };
      return copy;
      // 신호가 들어온 순서대로 정렬 - 빈도가 너무 잦아 UX 저해
      // return [ { ...prev[i], ...next }, ...prev.slice(0, i), ...prev.slice(i + 1) ];
    });
  }, []);

  // 전역 브릿지 등록/해제
  useEffect(() => {
    window.__pushRseItem = upsertItem;
    return () => {
      if (window.__pushRseItem === upsertItem) 
        delete window.__pushRseItem;
    };
  }, [upsertItem]);

  return (
    <div
      className={[
        "transition-colors h-full min-h-0",
        className,
      ].join(" ")}
    >
      {items.length === 0 ? (
        <Card className="h-full grid place-items-center text-slate-400">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
            </svg>
            <span>Scanning stations…</span>
          </div>
        </Card>
      ) : (
        <div className="overflow-y-auto p-2 rounded-xl ring-2 ring-white/10 space-y-2 bg-[#122033]/80">
          {items.map((it) => {
            const active = selectedId === it.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect?.(it)}
                className={[
                  "w-full grid grid-cols-3 items-center justify-items-stretch rounded-2xl px-2 py-2.5 text-left",
                  "ring-1 ring-white/10 transition-colors",
                  active ? "bg-slate-700/40" : "bg-[#0f172a]",
                ].join(" ")}
                aria-pressed={active}
                aria-label={`${it.serial}`}
              >
                {/* 좌측: LED + 시리얼 */}
                <div className="flex items-center gap-3 min-w-0">
                  <Led on={it.active} />
                  <div className="truncate">
                    <div className="font-semibold tracking-tight truncate">{it.serial}</div>
                  </div>
                </div>

                {/* 중앙: Health 도넛 */}
                <div className="flex justify-center items-center">
                  <Donut
                    value={it.health.pct}
                    color={healthColorForPct(it.health.pct)}
                    showValue={false} 
                    size={30}
                    stroke={6}
                    variant="conic"
                  />
                  <span className="text-slate-300 text-sm w-14 text-right">{it.health.pct}%</span>
                </div>

                {/* 우측: 신호 막대 + (라벨은 기존 그대로 dBm) */}
                <div className="flex justify-end gap-3 shrink-0">
                  <SignalBars bars={it.bars} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}