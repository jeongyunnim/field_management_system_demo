// src/components/MonitoringDeviceList.jsx
import { useEffect, useMemo } from "react";
import Donut from "../common/Donut";
import Led from "../common/Led";
import SignalBars from "../common/SignalBars";
import { Card } from "../common/Card";
import { useInspectStore } from "../../stores/InspectStore";
import { useRseStore } from "../../stores/RseStore";

export default function MonitoringDeviceList({ onSelect, selectedId, className = "" }) {
  const phase = useInspectStore((s) => s.phase);
  const inspecting = phase === "running";

  const byId = useRseStore((s) => s.byId);
  const warningById = useRseStore((s) => s.warningById);
  const clearStore = useRseStore((s) => s.clear); // 🆕

  const items = useMemo(() => {
    const arr = Object.values(byId);

    // 🆕 등록된 장치만 필터링 (isRegistered 플래그 사용)
    const registered = arr.filter(device => device?.isRegistered === true);

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
  }, [byId]);

 
  // 🆕 점검 종료 시 자동 초기화
  useEffect(() => {
    if (phase === "idle" || phase === "completed" || phase === "error") {
      clearStore();
    }
  }, [phase, clearStore]);

  if (!inspecting) {
    return (
      <Card className={["h-full grid place-items-center text-slate-300", className].join(" ")}>
        <div className="text-center space-y-2">
          <div className="text-lg">점검을 시작해 주세요.</div>
          {/* 🆕 상태별 안내 메시지 */}
          {phase === "completed" && (
            <div className="text-sm text-green-400">✓ 이전 점검 완료</div>
          )}
          {phase === "error" && (
            <div className="text-sm text-red-400">⚠ 이전 점검 오류</div>
          )}
        </div>
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
          <span>등록된 장치 검색 중…</span> {/* 🆕 문구 수정 */}
        </div>
      </Card>
    );
  }

  return (
    <div className={["transition-colors h-full min-h-0", className].join(" ")}>
      <div className="overflow-y-auto max-h-80 p-2 rounded-xl ring-2 ring-white/10 space-y-2 bg-[#122033]/80">
        {items.map((it) => {
          const active = selectedId === it.id;
          const hasWarning = warningById[it.id]; // 🆕 경고 상태 확인
          
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect?.(it)}
              className={[
                "w-full grid grid-cols-3 items-center justify-items-stretch rounded-2xl px-2 py-2.5 text-left",
                "ring-1 transition-all duration-200", // 🆕 transition 추가
                active 
                  ? "bg-slate-700/40 ring-blue-400/50 shadow-lg" // 🆕 선택 시 강조
                  : hasWarning
                  ? "bg-red-900/20 ring-red-500/30 hover:bg-red-900/30" // 🆕 경고 시 빨강
                  : "bg-[#0f172a] ring-white/10 hover:bg-slate-800/30", // 기본
              ].join(" ")}
              aria-pressed={active}
              aria-label={`${it.serial} - ${it.active ? '활성' : '비활성'}`} // 🆕 접근성 개선
            >
              {/* 좌측: LED + 시리얼 */}
              <div className="flex items-center gap-3 min-w-0">
                <Led on={it.active} />
                <div className="truncate font-semibold tracking-tight">
                  {it.serial}
                  {/* 🆕 경고 표시 */}
                  {hasWarning && (
                    <span className="ml-2 text-red-400 text-xs">⚠</span>
                  )}
                </div>
              </div>

              {/* 중앙: Health 도넛 */}
              <div className="flex justify-center items-center gap-2"> {/* 🆕 gap 추가 */}
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