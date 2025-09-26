// SystemStatsCard.jsx
import React from "react";
import { Card } from "../pages/Main";

export default function SystemStatsCard() {
  // 임의 값(%) — 필요시 API 데이터로 교체
  const data = [
    { key: "unknown",  label: "미확인", value: 5,  color: "#DAE1EB" }, // slate-300
    { key: "ok",       label: "정상",   value: 65,  color: "#28B555" }, // emerald-500
    { key: "fault",    label: "장애",   value: 25,  color: "#FF4D4D" }, // red-500
    { key: "etc",      label: "기타",   value: 5,  color: "#FFA041" }, // amber-500
  ];

  const byKey = Object.fromEntries(data.map(d => [d.key, d]));
  const order = ["ok", "fault", "etc", "unknown"];
  const display = order.map(k => byKey[k]).filter(Boolean);

  return (
    <Card className="w-full">
    <div className="flex flex-row justify-between">
      <h2 className="text-4xl font-semibold">
          시스템 통계
      </h2>
      <div className="flex flex-row mr-20 text-2xl">
        <Legend dot="bg-emerald-500" label="정상" />
        <Legend dot="bg-rose-500"    label="장애" />
        <Legend dot="bg-amber-500"   label="기타" />
        <Legend dot="bg-slate-300"   label="미확인" />
      </div>
    </div>


    <div className="flex w-full h-[calc(100%-3.5rem)] content-center justify-evenly flex-wrap gap-y-8">
      {display.map(d => (
        <Donut key={d.key} value={d.value} color={d.color} label={d.label} />
      ))}
    </div>
    </Card>
  );
}

function Donut({ value = 0, color = "#22c55e", size = 300, stroke = 35, label = "" }) {
  // SVG 원주 계산
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;

  return (
    <div className="relative place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        {/* 배경 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.25)"     // slate-400/25
          strokeWidth={stroke}
        />
        {/* 진행(bar) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {/* 중앙 수치 */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <span className="text-5xl font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }) {
  return (
    <div className="flex items-center gap-3 ml-7">
      <span className={`h-3.5 w-3.5 rounded-full ring-1 ring-black/10 ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
