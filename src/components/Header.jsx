// src/components/Header.jsx
import InspectionButton from "./InspectionButton";
import { useMqttStore } from "../stores/MqttStore";

export default function Header({ activePage, isDarkMode, setIsDarkMode }) {
  const pageMap = {
    Dashboard: ["Dashboard"],
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

  // 요청/응답/데이터 토픽
  const REQ_TOPIC = "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/req";
  const TOPICS = [
    "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
  ];

  // 버튼 시작: 브로커 구독 + 서버에 구독 요청 1회
  const handleStart = () => {
    if (!connected) { alert("MQTT가 연결되지 않았습니다."); return; }
    subscribeTopics(TOPICS, { qos: 0 }); // MQTT 레벨 구독
    publish(REQ_TOPIC, {                  // 앱 프로토콜 구독 요청
      action: "subscribe",
      options: { VER: "1.0", TRANSACTION_ID: 123456789, TS: "2025-09-16T11:40:00+09:00"},
    }, { qos: 0 });
  };

  // 버튼 중단: 서버에 unsubscribe + MQTT 구독 해제
  const handleStop = () => {
    publish("fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/req", { 
      action: "unsubscribe", 
      options: { VER: "1.0", TRANSACTION_ID: 123456789, TS: "2025-09-16T11:40:00+09:00"},
    }, { qos: 0});
    unsubscribeTopics("fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp");
  };

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
        <button className="hover:text-black dark:hover:text-white">📊 Add ▼</button>
        <button className="hover:text-black dark:hover:text-white">⚙️</button>
        <button className="hover:text-black dark:hover:text-white">🕒 Last 5 seconds ▼</button>
        <button className="hover:text-black dark:hover:text-white">🔍</button>
        <button className="hover:text-black dark:hover:text-white">🔄</button>

        {/* 전역 점검 버튼 */}
        <InspectionButton
          onStart={handleStart}
          onStop={handleStop}
          widthClass="w-40"
          heightClass="h-10"
          className="shadow-sm"
        />

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="hover:text-black dark:hover:text-white"
        >
          {isDarkMode ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>
    </header>
  );
}
