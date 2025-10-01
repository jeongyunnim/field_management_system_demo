// src/components/SystemResourcePanel.jsx
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, LinearScale, PointElement, CategoryScale, Filler, Tooltip);

/* ---------- 재사용: 이름 + 차트 + 수치 한 덩어리 ---------- */
function MetricChip({ label, series = [], value = 0 }) {
  const v = clamp(value, 0, 100);
  const color = tone(v); // hex
  const rgb = hex2rgb(color).join(",");
  const data = {
    labels: series.map((_, i) => i),
    datasets: [
      {
        data: series,
        borderColor: color,
        backgroundColor: `rgba(${rgb},0.16)`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    animation: false,
  };

  return (
    <div
    className="relative w-full h-24 rounded-xl overflow-hidden ring-1 ring-white/20 bg-[#0f172a] shadow-sm"
    aria-label={`${label} ${v}%`}
    title={`${label} ${v}%`}
    >
      {/* 차트 배경 */}
      <div className="absolute inset-0">
        <Line data={data} options={options} />
      </div>

      {/* 상단 오버레이: 이름 */}
      <div className="flex flex-col inset-0 px-3 py-2 flex items-center justify-between">
        <div className="text-lg font-semibold" style={{ color }}>
          {v.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

/* ---------- 패널: 3개 칩 배치 ---------- */
export default function SystemResourcePanel({
  cpuSeries,
  emmcSeries,
  ramSeries,
  demo = false,
}) {
  const init = useMemo(
    () => ({
      cpu: cpuSeries?.length ? cpuSeries : seed(30, 42),
      emmc: emmcSeries?.length ? emmcSeries : seed(30, 28),
      ram: ramSeries?.length ? ramSeries : seed(30, 61),
    }),
    [cpuSeries, emmcSeries, ramSeries]
  );
  const [s, setS] = useState(init);

  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => {
      setS((v) => ({ cpu: tick(v.cpu), emmc: tick(v.emmc), ram: tick(v.ram) }));
    }, 1000);
    return () => clearInterval(id);
  }, [demo]);

  const last = (arr) => (arr?.length ? arr.at(-1) : 0);

  return (
    <div className="h-36 col-span-4 bg-slate-900 rounded-xl ring-1 ring-slate-900/10 border border-white/10 bg-[#122033]/60 p-2 shadow-md">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center ">
          <span className="text-slate-200 text-lg">CPU</span>
          <MetricChip label="CPU"  series={s.cpu}  value={last(s.cpu)} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">eMMC</span>
          <MetricChip label="eMMC" series={s.emmc} value={last(s.emmc)} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">RAM</span>
          <MetricChip label="RAM"  series={s.ram}  value={last(s.ram)} />
        </div>
      </div>
    </div>
  );
}

/* ---------- utils ---------- */
function seed(n = 30, start = 40) {
  const out = []; let v = start;
  for (let i = 0; i < n; i++) { v = clamp(v + (Math.random() - 0.5) * 8, 3, 97); out.push(round1(v)); }
  return out;
}
function tick(arr) {
  const next = arr.slice(-29);
  const last = arr.at(-1) ?? 50;
  next.push(round1(clamp(last + (Math.random() - 0.5) * 8, 3, 97)));
  return next;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function round1(v){ return Math.round(v * 10)/10; }
function tone(p){
  if (p >= 75) return "#ef4444"; // 높은 사용률 경고
  if (p >= 55) return "#f59e0b"; // 주의
  return "#22c55e";              // 정상
}
function hex2rgb(hex) {
  const c = hex.replace("#",""); const n = parseInt(c.length===3?c.split("").map(x=>x+x).join(""):c,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function shade(hex, amount=-10) {
  const [r,g,b]=hex2rgb(hex); const f=(x)=>clamp(Math.round(x+(255*amount)/100),0,255);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
