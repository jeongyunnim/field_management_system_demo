// MainSystemStats.jsx
import React from "react";
import { Card } from "./common/Card";
import Donut from "./common/Donut";
import { useInspectStore } from "../stores/InspectStore";

export default function MainSystemStats() {
  const phase = useInspectStore((s) => s.phase);
  const inspecting = phase === "running";

  // 임의 값(%) — 필요시 API 데이터로 교체
  const data = [
    { key: "unknown", label: "미확인", value: 5,  color: "#DAE1EB" },
    { key: "ok",      label: "정상",   value: 65, color: "#28B555" },
    { key: "fault",   label: "장애",   value: 25, color: "#FF4D4D" },
    { key: "etc",     label: "기타",   value: 5,  color: "#FFA041" },
  ];
  const byKey = Object.fromEntries(data.map(d => [d.key, d]));
  const order = ["ok", "fault", "etc", "unknown"];
  const display = order.map(k => byKey[k]).filter(Boolean);

  if (!inspecting) {
    return (
      <Card className="h-full grid place-items-center text-slate-300">
        점검을 시작해 주세요.
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-row justify-between">
        <h2 className="main-card-title">시스템 통계</h2>
        <div className="flex flex-row text-md">
          <Legend dot="bg-emerald-500" label="정상" />
          <Legend dot="bg-rose-500"    label="장애" />
          <Legend dot="bg-amber-500"   label="기타" />
          <Legend dot="bg-slate-300"   label="미확인" />
        </div>
      </div>

      <div className="grid grid-cols-2 grid-rows-2 w-full h-full mt-6 place-items-center gap-6">
        {display.map(d => (
          <div key={d.key} className="flex flex-col items-center justify-center">
            <Donut size={150} value={d.value} color={d.color} />
            <span className="mt-3 text-lg">{d.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Legend({ dot, label }) {
  return (
    <div className="flex items-center ml-7">
      <span className={`h-1.5 w-1.5 rounded-full ring-1 ring-black/10 ${dot} mr-2`} />
      <span>{label}</span>
    </div>
  );
}
