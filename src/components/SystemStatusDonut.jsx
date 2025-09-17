// src/components/SystemStatusDonut.jsx
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import React from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

function SystemStatusDonut({ status }) {
  const items = [
    { key: "gnss_antenna_status", label: "GNSS" },
    { key: "ltev2x_antenna1_status", label: "V2X 안테나 1" },
    { key: "ltev2x_antenna2_status", label: "V2X 안테나 2" },
    { key: "temperature_status.temperature_status", label: "온도" },
    { key: "v2x_usb_status", label: "V2X-USB" },
    { key: "v2x_spi_status", label: "V2X-SPI" },
    { key: "sram_vbat_status", label: "SRAM_VBAT" },
    { key: "ltev2x_tx_ready_status", label: "LTEV2X TX Ready" }
  ];

  const getValue = (obj, path) =>
    path.split(".").reduce((acc, p) => acc?.[p], obj);

  const data = {
    labels: items.map((i) => i.label),
    datasets: [
      {
        data: items.map(() => 1),
        backgroundColor: items.map((i) =>
          getValue(status, i.key) === true ? "#34d399" : "#f87171"
        ),
        borderWidth: 0
      }
    ]
  };

  const centerTextPlugin = {
    id: "centerText",
    beforeDraw: (chart) => {
      const { width, height, ctx } = chart;
      ctx.restore();

      const fontSize = (height / 130).toFixed(2);
      ctx.font = `${fontSize}em sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "#374151"; // Tailwind gray-700

      const text = "H/W";
      ctx.fillText(text, width / 2, height / 2);
      ctx.save();
    }
  };

  const options = {
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        displayColors: false,
        callbacks: {
          title: () => "",
          label: function (context) {
            // 첫 줄: 항목 이름
            return context.label + ":";
          },
          afterLabel: function (context) {
            const index = context.dataIndex;
            const item = items[index];
            const value = getValue(status, item.key);
            const statusLabel = value === true ? "✅ 정상" : "❌ 비정상";
            // 둘째 줄: 상태
            return statusLabel;
          }
        }
      }
    },
    cutout: "55%",
    centerText: {}
  };

  return (
    <div className="flex flex-col items-center">
      {/* 도넛 차트 */}
      <div className="relative w-32 h-32 overflow-visible">
        <Doughnut data={data} options={options} plugins={[centerTextPlugin]} />
      </div>

      {/* 범례 (설명) */}
      <div className="mt-1 flex space-x-4 text-sm text-gray-600">
        <div className="flex items-center space-x-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
          <span>정상</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
          <span>비정상</span>
        </div>
      </div>

      {/* 제목 */}
      {/* <div className="mt-3 text-base font-semibold text-gray-800">
        하드웨어 상태
      </div> */}
    </div>
  );
}

function areStatusEqual(prevProps, nextProps) {
  return JSON.stringify(prevProps.status) === JSON.stringify(nextProps.status);
}

export default React.memo(SystemStatusDonut, areStatusEqual);
