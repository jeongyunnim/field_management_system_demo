// src/components/Header.jsx
import { useEffect, useState } from "react";
import StartInspectionButton from "./buttons/StartInspectionButton";
import StopInspectionButton from "./buttons/StopInspectionButton";
import { useMqttStore } from "../stores/MqttStore";

export default function Header({ activePage }) {
  const [isInspecting, setIsInspecting] = useState(false);
  const pageMap = {
    Main: ["Main"],
    DeviceList: ["장치 관리"],
    WirelessDevices: ["장치 모니터링"],
    Settings: ["설정"],
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
    <header className="flex h-24 items-center justify-between px-10 py-3 bg-[#121d2d]">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-1 text-slate-400 text-lg">
        <span>Home</span>
        {path.map((item, index) => (
          <span key={index} className="flex items-center space-x-2">
            <span>&gt;</span>
            <span className={`${index === path.length - 1 ? "text-gray-100 " : ""}`}>
              {item}
            </span>
          </span>
        ))}
      </div>
          
      {/* Action buttons */}
      <div className="flex items-center space-x-3 text-2xl text-slate-100">
        <StartInspectionButton
          onStart={handleStart}
          className="shadow-sm"
          disabled={isInspecting}  // 점검 중이면 시작 버튼 비활성
          onBegan={onBegan}
        />

        <StopInspectionButton
          onStop={handleStop}
          className="shadow-sm"
          disabled={!isInspecting} // 점검 중일 때만 활성
          onEnded={onEnded}
        />
        <div className="text-lg">
          {/* 사용자 이미지 넣기? */}
          TEST_USER1
        </div>
        <button className="btn btn-text">
          Logout
        </button>
      </div>
    </header>
  );
}