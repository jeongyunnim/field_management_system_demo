// src/components/sidebar/SidebarStatusPanel.jsx
import React from "react";
import { Activity, Radio, Loader2, Navigation2 } from "lucide-react";

// 작은 뱃지
const Badge = ({ ok, lte = false }) => (
  <span
    className={`inline-block h-3 w-10 rounded-full shadow 
      ${ok ? "bg-[#32E36C] animate-pulse" : "bg-rose-500 "}
      ${lte ? "mr-1" : ""}
      `}
  />
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
          shadow-sm px-2 py-2
        "
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between m-3 space-x-2">
          <div className="flex items-center gap-2 text-slate-200">
            <Activity size={20} className="opacity-80" />
            {!isCollapsed && <span className="text-sm font-semibold">V2X-FMS</span>}
          </div>
          {
            v2xReady == null ? <Loader2 size={5} className="animate-spin opacity-70" /> : <Badge ok={v2xReady} />
          }
        </div>

        {isCollapsed ? (
            <span className={`h-4 w-6 rounded-full ${v2xReady ? "bg-emerald-400" : "bg-rose-400"}`} />
        ) : (
          <>
            <div className="grid gap-2">
              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-1">
                <div className="flex items-center justify-between side-status-title font-semibold">
                  <span>LTE-V2X</span>
                  {v2xReady == null ? <Skel /> : <Badge ok={!!v2xReady} lte={true} />}
                </div>
              </div>

              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-1">
                <div className="flex items-center gap-1 side-status-title font-semibold border-b-indigo-500 fms-bt">
                  <span>채널</span>
                </div>
                <div className="mt-1 space-y-0.5 side-status-title">
                  <Row label="Frequency" value={freqMHz != null ? `${freqMHz} MHz` : <Skel />} mono />
                  <Row label="Band Width" value={bwMHz   != null ? `${bwMHz} MHz`   : <Skel />} mono />
                </div>
              </div>

              <div className="rounded-lg border border-slate-600/60 bg-slate-700/60 px-2 py-1">
                <div className="side-status-title font-semibold fms-bt">Packet TX/RX</div>
                <div className="mt-1 space-y-0.5 side-status-title">
                  <Row label="TX" value={txCount != null ? txCount.toLocaleString() : <Skel />} mono />
                  <Row label="RX" value={rxCount != null ? rxCount.toLocaleString() : <Skel />} mono />
                </div>
              </div>

              {/* GNSS 박스 */}
              <div className="rounded-xl border border-slate-600/70 bg-slate-700/50 px-3 py-1">
                <div className="flex items-center gap-2 text-slate-200 mb-1.5 fms-bt">
                  <span className="side-status-title font-semibold ">GNSS</span>
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-1 side-status-title">
                  <Row label="mode"    value={gnss.fix ?? <Skel />} />
                  <Row label="위도"    value={gnss.lat != null ? gnss.lat : <Skel />} mono />
                  <Row label="경도"    value={gnss.lon != null ? gnss.lon : <Skel />} mono />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
