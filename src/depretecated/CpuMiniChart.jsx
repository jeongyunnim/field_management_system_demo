import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  CategoryScale,
  Filler
} from "chart.js";

ChartJS.register(LineElement, LinearScale, PointElement, CategoryScale, Filler);

export default function CpuMiniChart({ usageHistory, currentUsage }) {
  const data = {
    labels: usageHistory.map((_, i) => i),
    datasets: [
      {
        label: "CPU 사용률",
        data: usageHistory,
        borderColor: "#0ea5e9", // sky-500
        backgroundColor: "rgba(14, 165, 233, 0.15)", // 밝은 파랑 투명 배경
        fill: true, // ✅ 선 아래 면 채우기
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: false },
      y: { display: false, min: 0, max: 100 }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => `CPU: ${ctx.raw.toFixed(1)}%`
        }
      }
    },
    animation: false
  };

  return (
    <div className="flex items-center space-x-3 bg-white p-2 border border-gray-200 rounded shadow-sm w-fit">
      {/* 그래프 */}
      <div className="w-28 h-12 bg-white rounded overflow-hidden">
        <Line data={data} options={options} />
      </div>

      {/* 텍스트 정보 */}
      <div className="text-sm text-gray-800 leading-tight">
        <div className="font-semibold">CPU</div>
        <div className="text-xs text-gray-500">{currentUsage.toFixed(1)}%</div>
      </div>
    </div>
  );
}
