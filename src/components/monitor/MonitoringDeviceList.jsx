// src/components/MonitoringDeviceList.jsx
import { useEffect, useMemo, useRef, useState, useCallback} from "react";
import Donut, { healthColorForPct } from "../common/Donut";
import Led from "../common/Led";
import SignalBars from "../common/SignalBars";
import { rssiToBars } from "../../utils/signal";

function hdopToBars(hdop) {
  if (!isFinite(hdop)) return 0;
  if (hdop <= 0.8) return 4;
  if (hdop <= 1.5) return 3;
  if (hdop <= 3.0) return 2;
  if (hdop <= 6.0) return 1;
  return 0;
}

// 전반적 Health(0~100) 산출: 하드웨어 플래그/리소스/온도/1PPS 등을 가중
function computeHealth(m) {
  const ok = (v) => (v ? 1 : 0);

  const hwScore =
    ok(m.gnss_antenna_status) +
    ok(m.ltev2x_antenna1_status) +
    ok(m.ltev2x_antenna2_status) +
    ok(m.v2x_usb_status) +
    ok(m.v2x_spi_status) +
    ok(m.sram_vbat_status);
  const hwPct = (hwScore / 6) * 60; // 하드웨어 가중 60%

  const cpuPct = Math.max(0, 100 - (m.cpu_usage_status?.cpu_usage_total_percent ?? 100)); // 낮을수록 가점
  const memUsedPct = m.memory_usage_status?.memory_usage_percent ?? 100;
  const memPct = Math.max(0, 100 - memUsedPct);
  const diskUsedPct = m.storage_usage_status?.storage_usage_percent ?? 100;
  const diskPct = Math.max(0, 100 - diskUsedPct);

  // 온도: 40~70℃를 안전범위로 보고 클램핑
  const temp = m.temperature_status?.temperature_celsius ?? 70;
  const tempPenalty = (() => {
    if (temp <= 40) return 0;
    if (temp >= 80) return 40;
    return ((temp - 40) / 40) * 40; // 최대 40점 페널티
  })();
  const tempPct = Math.max(0, 40 - tempPenalty); // 최대 40 → 0

  // 1PPS 미동기면 추가 감점
  const ppsPenalty = m.secton_1pps_status ? 0 : 10;

  // 소계 가중치: HW 60 + CPU 10 + MEM 10 + DISK 10 + TEMP 10 = 100
  const score =
    hwPct +
    (cpuPct * 0.10) +
    (memPct * 0.10) +
    (diskPct * 0.10) +
    (tempPct * 0.10) -
    ppsPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// HDOP 기반 “신호 dBm 비슷한 수치” (UI에서 dBm 라벨을 쓰고 있으므로 대충 매핑)
function hdopToDbm(hdop) {
  if (!isFinite(hdop)) return -120;
  // hdop 0.8 → -60 근처, 1.5 → -70대, 3.0 → -90대, 6.0 → -110 이하
  const s = -120 + Math.round(Math.max(0, (6 - Math.min(hdop, 6))) * (60 / 6));
  return Math.max(-120, Math.min(-50, s));
}

export function rseToItem(m) {
  const hdop = parseFloat(m?.gnss_data?.hdop ?? "NaN");
  const bars = hdopToBars(hdop);
  const signalDbm = hdopToDbm(hdop);

  return {
    id: m.serial_number,
    serial: m.serial_number,
    active: !!(m.ltev2x_tx_ready_status || m.gnss_antenna_status),
    health: computeHealth(m),       // 0~100 정수
    bars,                           // 0~4
    msgPerSec: signalDbm,           // UI 라벨이 dBm이므로 신호 풍으로 채움
    // 필요시 확장용 원본도 들고갈 수 있음
    __raw: m,
  };
}

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
        "p-3 transition-colors overflow-hidden h-full min-h-0",
        className,
      ].join(" ")}
    >
      {items.length === 0 ? (
        <div className="h-24 grid place-items-center text-slate-400">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
            </svg>
            <span>Scanning stations…</span>
          </div>
        </div>
      ) : (
        <div className="h-full overflow-y-scroll pr-1 space-y-2">
          {items.map((it) => {
            const active = selectedId === it.id;
            // TODO: 실제 값과 바인딩 해야 함
            const TEMP_DGM = -75;
            const dbm = Number.isFinite(it.signalDbm) ? it.signalDbm : TEMP_DBM;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelect?.(it)}
                className={[
                  "w-full grid grid-cols-3 items-center justify-items-stretch gap-4 rounded-2xl px-3 py-2.5 text-left",
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
                    value={it.health}
                    color={healthColorForPct(it.health)}
                    size={24}
                    stroke={6}
                    variant="conic"
                  />
                  <span className="text-slate-300 text-sm w-14 text-right">{it.health}%</span>
                </div>

                {/* 우측: 신호 막대 + (라벨은 기존 그대로 dBm) */}
                <div className="flex justify-end gap-3 shrink-0">
                  <SignalBars bars={it.bars} />
                  <div className="text-xs text-slate-300 whitespace-nowrap">
                    {dbm} dBm
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}