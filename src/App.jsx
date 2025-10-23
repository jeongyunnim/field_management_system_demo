// src/App.jsx
import { useState, useEffect } from "react";
import { useMqttStore } from "./stores/MqttStore";
import { useAuthStore } from "./stores/AuthStore";
import { initMqttBus, disposeMqttBus } from "./services/mqtt/bus";
import Sidebar from "./components/sidebar/Sidebar.jsx";
import Header from "./components/Header";

import Login from "./pages/Login.jsx";
import Main from "./pages/Main.jsx";
import DeviceList from "./pages/DeviceList.jsx";
import DeviceMonitoring from "./pages/DeviceMonitoring.jsx";
import Settings from "./pages/Settings.jsx";
import StationMapPanel from "./components/monitor/StationMapPanel.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("Main");
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 인증 상태
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  /** MQTT 초기화 */
  const connect = useMqttStore((s) => s.connect);
  const disconnect = useMqttStore((s) => s.disconnect);

  useEffect(() => {
    // 로그인된 경우에만 MQTT 연결
    if (isAuthenticated) {
      connect();                     // MqttStore 연결
      const off = initMqttBus();     // 버스 초기화
      return () => { 
        off?.(); 
        disconnect(); 
      };
    }
  }, [isAuthenticated, connect, disconnect]);

  // 로그인되지 않은 경우 로그인 화면 표시
  if (!isAuthenticated) {
    return <Login />;
  }

  const renderCenter = () => {
    switch (activePage) {
      case "Main":
        return <Main />;
      case "DeviceList":
        return <DeviceList setActivePage={setActivePage} />;
      case "DeviceMonitoring":
        return <DeviceMonitoring setActivePage={setActivePage} />;
      case "Settings":
        return <Settings />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="h-dvh w-dvw bg-[#121d2d] flex items-center justify-center">
      <div className="w-1/5 flex flex-1 h-full min-h-0">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />
        <div className="w-4/5 flex flex-1 min-h-0 flex-col">
          {/* Header */}
          <Header
            activePage={activePage}
          />

          {/* main view */}
          <main className="w-full flex-1 min-h-0 p-7">
            {activePage === "DeviceList" || activePage === "DeviceMonitoring" ? (
              <div className="grid grid-cols-[2fr_1fr] w-full h-full gap-3">
                {renderCenter()}
                <StationMapPanel />
              </div>
            ) : (
              renderCenter()
            )}
          </main>
        </div>
      </div>
    </div>
  );
}