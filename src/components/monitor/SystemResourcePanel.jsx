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
  Decimation,            // ✅ 내장 decimation 플러그인
} from "chart.js";

ChartJS.register(LineElement, LinearScale, PointElement, CategoryScale, Filler, Tooltip, Decimation);

/* ---------- 재사용: 이름 + 차트 + 수치 한 덩어리 (제어형) ---------- */
function MetricChip({
  label,
  series = [],
  value,
  xWindow = 10,               // ✅ 추가: 마지막 N개만 표시 (예: 120)
  yMin = 0,              // ✅ 추가: Y축 최소값 (기본 0)
  yMax = 100,            // ✅ 추가: Y축 최대값 (기본 100)
  decimateSamples,       // ✅ 추가: lttb decimation 목표 샘플 수 (예: 200)
}) {
  const last = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);
  // 표시용 값: 최신값 우선, 없으면 시리즈 마지막 점
  const raw = Number.isFinite(value) ? value : (last(series) ?? 0);
  const v = clamp(raw, yMin, yMax);

  // === X축 가시구간: xWindow가 있으면 꼬리만 사용 ===
  const visible = Array.isArray(series)
    ? (typeof xWindow === "number" && xWindow > 0 ? series.slice(-xWindow) : series)
    : [];

  // === Decimation: 점이 너무 많으면 시인성 향상 ===
  // Chart.js LTTB decimation은 옵션에서 켬. 데이터는 그대로 넘김.
  const labels = visible.map((_, i) => i); // 간단한 인덱스 라벨

  const color = tone(v);
  const rgb = hex2rgb(color).join(",");
  const data = {
    labels,
    datasets: [
      {
        data: visible,
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
    scales: {
      x: { display: false },
      y: {
        display: false,
        min: yMin,
        max: yMax,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      // ✅ decimation: 시리즈가 매우 길 때 자동 간소화 (시인성↑, 성능↑)
      decimation: decimateSamples
        ? { enabled: true, algorithm: "lttb", samples: decimateSamples }
        : { enabled: false },
    },
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
          {to1(v)}%
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

  xWindow,             // 마지막 N개만 표시 (예: 120). 미지정 시 전체 사용
  yMin = 0,            // Y축 최소
  yMax = 100,          // Y축 최대
  decimateSamples,     // LTTB 목표 샘플 수 (예: 200). 미지정 시 decimation off
}) {
  return (
    <div className="h-36 col-span-4 bg-slate-900 rounded-xl ring-1 ring-slate-900/10 border border-white/10 bg-[#122033]/60 p-2 shadow-md">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">CPU</span>
          <MetricChip
            label="CPU"
            series={cpuSeries}
            value={cpuValue}
            xWindow={xWindow}
            yMin={yMin}
            yMax={yMax}
            decimateSamples={decimateSamples}
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">eMMC</span>
          <MetricChip
            label="eMMC"
            series={emmcSeries}
            value={emmcValue}
            xWindow={xWindow}
            yMin={yMin}
            yMax={yMax}
            decimateSamples={decimateSamples}
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-slate-200 text-lg">RAM</span>
          <MetricChip
            label="RAM"
            series={ramSeries}
            value={ramValue}
            xWindow={xWindow}
            yMin={yMin}
            yMax={yMax}
            decimateSamples={decimateSamples}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- utils ---------- */
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function to1(n) { return Math.round(n * 10) / 10; }
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
