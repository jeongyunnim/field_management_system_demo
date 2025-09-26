// src/components/SidebarStatusPanel.jsx
import React from "react";
import { Activity, Radio, Loader2, Navigation2 } from "lucide-react";

// 작은 뱃지
const Badge = ({ ok }) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium
      ${ok ? "bg-emerald-200/80 text-emerald-900" : "bg-rose-200/80 text-rose-900"}`}
  >
    {ok ? "OK" : "NG"}
  </span>
);

// 항목 한 줄
const Row = ({ label, value, mono=false }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-300">{label}</span>
    <span className={`text-slate-50 ${mono ? "font-mono tabular-nums" : ""}`}>{value ?? "-"}</span>
  </div>
);

// 스켈레톤(값 미도착 시)
const Skel = () => <span className="inline-block h-4 w-16 animate-pulse rounded bg-slate-600/60" />;

export default function SidebarStatusPanel({
  isCollapsed = false,               // 사이드바 접힘 여부
  v2xReady = null,                   // true/false/null(로드중)
  freqMHz,                           // number | undefined
  bwMHz,                             // number | undefined
  txCount,                           // number
  rxCount,                           // number
  gnss = {                           // { fix, lat, lon, headingDeg, speedKmh }
    fix: undefined, lat: undefined, lon: undefined, headingDeg: undefined, speedKmh: undefined
  },
  className = "",
}) {
  // 하단 고정 + 사이드바 톤과 조화
  return (
    <div
      className={`
        mt-auto p-3
        ${className}
      `}
    >
      <div
        className="
          rounded-xl border border-slate-600/70 bg-slate-800/80
          shadow-sm px-3 py-3
        "
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-slate-200">
            <Activity size={16} className="opacity-80" />
            {!isCollapsed && <span className="text-sm font-semibold">V2X-FMS 상태</span>}
          </div>
          {!isCollapsed && (
            v2xReady == null ? <Loader2 size={14} className="animate-spin opacity-70" /> : <Badge ok={!!v2xReady} />
          )}
        </div>

        {/* 접힘 상태: 간단 LED들만 */}
        {isCollapsed ? (
          <div className="flex items-center justify-between">
            {/* LTE */}
            <div className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${v2xReady ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="sr-only">LTE-V2X Ready</span>
            </div>
            {/* 채널 */}
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <span className="sr-only">Channel</span>
            </div>
            {/* GNSS */}
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="sr-only">GNSS</span>
            </div>
          </div>
        ) : (
          <>
            {/* 상단 3칸: LTE/채널/패킷 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>LTE-V2X</span>
                  {v2xReady == null ? <Skel /> : <Badge ok={!!v2xReady} />}
                </div>
              </div>

              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-2">
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <Radio size={12} className="opacity-80" />
                  <span>채널</span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs">
                  <Row label="Frequency" value={freqMHz != null ? `${freqMHz} MHz` : <Skel />} mono />
                  <Row label="BW"        value={bwMHz   != null ? `${bwMHz} MHz`   : <Skel />} mono />
                </div>
              </div>

              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-2">
                <div className="text-xs text-slate-300">Packet TX/RX</div>
                <div className="mt-1 space-y-0.5 text-xs">
                  <Row label="TX" value={txCount != null ? txCount.toLocaleString() : <Skel />} mono />
                  <Row label="RX" value={rxCount != null ? rxCount.toLocaleString() : <Skel />} mono />
                </div>
              </div>
            </div>

            {/* GNSS 박스 */}
            <div className="mt-2 rounded-xl border border-slate-600/70 bg-slate-700/50 px-3 py-2">
              <div className="flex items-center gap-2 text-slate-200 mb-1.5">
                <Navigation2 size={14} className="opacity-80" />
                <span className="text-sm font-semibold">GNSS</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Row label="FIX"    value={gnss.fix ?? <Skel />} />
                <Row label="방향"    value={gnss.headingDeg != null ? `${gnss.headingDeg}°` : <Skel />} mono />
                <Row label="위도"    value={gnss.lat != null ? gnss.lat : <Skel />} mono />
                <Row label="경도"    value={gnss.lon != null ? gnss.lon : <Skel />} mono />
                <Row label="속도"    value={gnss.speedKmh != null ? `${gnss.speedKmh}km/h` : <Skel />} mono />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
