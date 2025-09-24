// src/components/Header.jsx
import { useEffect, useState } from "react";
import StartInspectionButton from "./StartInspectionButton";
import StopInspectionButton from "./StopInspectionButton";
import { useMqttStore } from "../stores/MqttStore";

export default function Header({ activePage, isDarkMode, setIsDarkMode }) {
  const [isInspecting, setIsInspecting] = useState(false);
  const pageMap = {
    Main: ["Main"],
    Notification: ["Events", "Notification"],
    DeviceList: ["Monitoring", "Device List"],
    WirelessDevices: ["Monitoring", "WirelessDevices"],
    MapView: ["Monitoring", "Map View"],
    Messages: ["Messages"],
    V2XTest: ["V2X Test"],
    Settings: ["Settings"],
    ExtensionStore: ["Extension Store"],
  };
  const path = pageMap[activePage] || [activePage];

  // ▼ MQTT store hooks
  const subscribeTopics   = useMqttStore((s) => s.subscribeTopics);
  const unsubscribeTopics = useMqttStore((s) => s.unsubscribeTopics);
  const publish           = useMqttStore((s) => s.publish);

  const handleStart = () => {
  };

  // 버튼 중단: 서버에 unsubscribe + MQTT 구독 해제
  const handleStop = () => {
    publish("fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/stopSystemCheck/req", { 
      VER: "1.0", TRANSACTION_ID: 123456790, TS: "2025-09-16T11:40:00+09:00"
    }, { qos: 0});
  };
  const onBegan = () => setIsInspecting(true);
  const onEnded = () => setIsInspecting(false);
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-white dark:bg-gray-800 shadow-sm">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 text-sm">
        <span>Home</span>
        {path.map((item, index) => (
          <span key={index} className="flex items-center space-x-2">
            <span>&gt;</span>
            <span className={`${index === path.length - 1 ? "font-medium text-gray-800 dark:text-white" : ""}`}>
              {item}
            </span>
          </span>
        ))}
      </div>

            {/* Action buttons */}
      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
        <StartInspectionButton
          onStart={handleStart}
          widthClass="w-32"
          heightClass="h-10"
          className="shadow-sm"
          disabled={isInspecting}  // 점검 중이면 시작 버튼 비활성
          onBegan={onBegan}
        />

        <StopInspectionButton
          onStop={handleStop}
          widthClass="w-32"
          heightClass="h-10"
          className="shadow-sm"
          disabled={!isInspecting} // 점검 중일 때만 활성
          onEnded={onEnded}
        />

        <div>TEST_USER1</div>
        <button className="btn bg-rose-500 text-white transition duration-200 hover:bg-rose-600 hover:shadow-lg hover:scale-105 active:scale-95 dark:hover:bg-rose-400">
          LOGOUT
        </button>
      </div>
    </header>
  );
}