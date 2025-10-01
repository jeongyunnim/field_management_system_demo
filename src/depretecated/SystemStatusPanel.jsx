// 예시 컴포넌트: components/SystemStatusPanel.jsx
export default function SystemStatusPanel({ status }) {
  const items = [
    { key: "gnss_antenna_status", label: "GNSS 안테나" },
    { key: "ltev2x_antenna1_status", label: "LTE-V2X 안테나1" },
    { key: "ltev2x_antenna2_status", label: "LTE-V2X 안테나2" },
    { key: "temperature_status.temperature_status", label: "온도 센서" },
    { key: "v2x_usb_status", label: "V2X USB" },
    { key: "v2x_spi_status", label: "V2X SPI" },
    { key: "sram_vbat_status", label: "SRAM 배터리" },
    { key: "ltev2x_tx_ready_status", label: "Tx 준비 상태" }
  ];

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => acc?.[part], obj);
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-sm text-gray-800 mt-4">
      {items.map(({ key, label }) => {
        const value = getNestedValue(status, key);
        const isOk = value === true;

        return (
          <div
            key={key}
            className={`flex items-center p-2 rounded ${
              isOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            <span className="w-4 h-4 rounded-full mr-2 flex items-center justify-center text-xs font-bold">
              {isOk ? "✔" : "✖"}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
}
