// src/components/SystemResourcePanel.jsx
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

/* ---------- 재사용: 이름 + 차트 + 수치 한 덩어리 (제어형) ---------- */
function MetricChip({ label, series = [], value }) {
  const last = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);
  const raw = Number.isFinite(value) ? value : (last(series) ?? 0);
  const v = clamp(raw, 0, 100);

  const color = tone(v);
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

      {/* 상단 오버레이: 수치 */}
      <div className="absolute inset-0 px-3 py-2 flex items-start justify-center">
        <div className="text-sm font-semibold" style={{ color }}>
          {v.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

/* ---------- 패널: 3개 칩 배치 (완전 제어형) ---------- */
export default function SystemResourcePanel({
  cpuSeries = [],      // 누적 시계열(0~100)
  emmcSeries = [],
  ramSeries = [],
  cpuValue,            // (선택) 최신 샘플값 — 숫자표시에만 사용
  emmcValue,
  ramValue,
}) {
  return (
    <div className="h-36 col-span-4 bg-slate-900 rounded-xl ring-1 ring-slate-900/10 border border-white/10 bg-[#122033]/60 p-2 shadow-md">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">CPU</span>
          <MetricChip label="CPU" series={cpuSeries} value={cpuValue} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">eMMC</span>
          <MetricChip label="eMMC" series={emmcSeries} value={emmcValue} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">RAM</span>
          <MetricChip label="RAM" series={ramSeries} value={ramValue} />
        </div>
      </div>
    </div>
  );
}

/* ---------- utils ---------- */
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function tone(p){
  if (p >= 75) return "#ef4444"; // 높은 사용률 경고
  if (p >= 55) return "#f59e0b"; // 주의
  return "#22c55e";              // 정상
}
function hex2rgb(hex) {
  const c = hex.replace("#","");
  const n = parseInt(c.length===3?c.split("").map(x=>x+x).join(""):c,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
