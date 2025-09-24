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
  const connected         = useMqttStore((s) => s.connected);
  const addMessageHandler = useMqttStore((s) => s.addMessageHandler);

  // 요청/응답/데이터 토픽
  const REQ_TOPIC = "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/startSystemCheck/req";
  const TOPICS = [
    "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
    "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/resp"
  ];

  useEffect(() => {
    const off = addMessageHandler((topic, message) => {
      // console.log("button response: ", topic);
      
      if (!topic.endsWith("startSystemCheck/resp") && !topic.endsWith("stopSystemCheck/resp")) return;

      // 안전 파싱
      let obj;
      try { obj = JSON.parse(message.toString()); }
      catch (e) {
        console.warn("startSystemCheck resp JSON parse failed:", e);
        alert("점검 응답 파싱에 실패했습니다.");
        return;
      }

      // 프로토콜 예: payload.data.CODE / payload.data.MSG 형태였음
      const code = obj?.data?.CODE ?? obj?.CODE;
      const msg  = obj?.data?.MSG  ?? obj?.MSG  ?? "응답 수신";

      if (Number(code) === 200) {
        console.log("✅ 확인 성공:", msg);
      } else {
        console.warn(`확인 실패${code ? ` (CODE ${code})` : ""}: ${msg}`);
      }
    });

    subscribeTopics(TOPICS, { qos: 0 }); // MQTT 레벨 구독

    return () => {
      off();
      unsubscribeTopics(TOPICS);
    };
  }, [addMessageHandler, subscribeTopics, unsubscribeTopics]);

  // 버튼 시작: 브로커 구독 + 서버에 구독 요청 1회
  const handleStart = () => {
    if (!connected) { alert("MQTT가 연결되지 않았습니다."); return; }
    publish(REQ_TOPIC, {                  // 앱 프로토콜 구독 요청
       VER: "1.0", TRANSACTION_ID: 123456789, TS: "2025-09-16T11:40:00+09:00"
    }, { qos: 0 });
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