// src/components/MonitoringDeviceList.jsx
import { useMemo } from "react";
import Donut from "../common/Donut";
import Led from "../common/Led";
import SignalBars from "../common/SignalBars";
import { Card } from "../common/Card";
import { useInspectStore } from "../../stores/InspectStore";
import { useRseStore } from "../../stores/RseStore";

export default function MonitoringDeviceList({ onSelect, selectedId, className = "" }) {
  const phase = useInspectStore((s) => s.phase);
  const inspecting = phase === "running";

  const byId = useRseStore((s) => s.byId);               // ✅ 원시 참조
  const warningById = useRseStore((s) => s.warningById); // ✅ 원시 참조

  const items = useMemo(() => {
    const arr = Object.values(byId);

    // 🚫 미확인 기기 제외 (id가 'unregistered_'로 시작하는 것 필터링)
    const registered = arr.filter(item => {
      const id = String(item.id || '');
      return !id.startsWith('unregistered_');
    });

    const natcmp = (a, b) =>
      String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    return registered
      .slice()
      .sort((a, b) => {
        const aActive = !!a.active;
        const bActive = !!b.active;
        if (aActive !== bActive) return aActive ? -1 : 1;

        const as = a.serial ?? a.id ?? "";
        const bs = b.serial ?? b.id ?? "";
        return natcmp(as, bs);
      });
  }, [byId, warningById]);

  // 안내/스캔/목록 간단 분기
  if (!inspecting) {
    return (
      <Card className={["h-full grid place-items-center text-slate-300", className].join(" ")}>
        점검을 시작해 주세요.
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className={["h-full grid place-items-center text-slate-400", className].join(" ")}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
          </svg>
          <span>Scanning stations…</span>
        </div>
      </Card>
    );
  }

  return (
    <div className={["transition-colors h-full min-h-0", className].join(" ")}>
      <div className="overflow-y-auto max-h-80 p-2 rounded-xl ring-2 ring-white/10 space-y-2 bg-[#122033]/80">
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
              aria-label={it.serial}
            >
              {/* 좌측: LED + 시리얼 */}
              <div className="flex items-center gap-3 min-w-0">
                <Led on={it.active} />
                <div className="truncate font-semibold tracking-tight">{it.serial}</div>
              </div>

              {/* 중앙: Health 도넛 */}
              <div className="flex justify-center items-center">
                <Donut
                  value={it.health?.pct ?? 0}
                  showValue={false}
                  size={30}
                  stroke={6}
                  variant="conic"
                />
                <span className="text-slate-300 text-sm w-14 text-right">{it.health?.pct ?? 0}%</span>
              </div>

              {/* 우측: 신호 막대 */}
              <div className="flex justify-end gap-3 shrink-0">
                <SignalBars bars={it.bars} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}