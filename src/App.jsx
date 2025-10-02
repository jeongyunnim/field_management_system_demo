// src/App.jsx
import { useState, useMemo, useLayoutEffect, useEffect } from "react";
// import mqtt from "mqtt"; // 스토어 내부에서 관리
import { useMqttStore } from "./stores/MqttStore";
import Sidebar from "./components/sidebar/Sidebar.jsx";
import Header from "./components/Header";

import Home from "./pages/Home.jsx";
import DeviceList from "./pages/DeviceList.jsx";
import RegisterDevice from "./pages/RegisterDevice.jsx";
import DeviceMonitoring from "./pages/DeviceMonitoring.jsx";
import Settings from "./pages/Settings.jsx";
import StationMapPanel from "./components/monitor/StationMapPanel.jsx";

export default function App() {
  const [activePage, setActivePage] = useState("Home");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [stationStatusMap, setStationStatusMap] = useState({});
  
  /** MQTT 초기화 */
  const connect = useMqttStore((s) => s.connect);
  const disconnect = useMqttStore((s) => s.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const renderCenter = () => {
    switch (activePage) {
      case "Home":
        return <Home />;
      case "DeviceList":
        return <DeviceList setActivePage={setActivePage} />;
      case "RegisterDevice":
        return <RegisterDevice setActivePage={setActivePage} />;
      case "DeviceMonitoring":
        return (
          <DeviceMonitoring
            setActivePage={setActivePage}
            onVehiclePosition={setVehiclePosition}
            onStatusUpdate={(l2id, status) =>
              setStationStatusMap((prev) => ({ ...prev, [l2id]: status }))
            }
          />
        );
      case "V2XTest":
        return <V2XTest />;
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

      {/* Main content area */}
        <div className="w-4/5 flex flex-1 min-h-0 flex-col">
          <Header
            activePage={activePage}
          />

          {/* ✅ Two-pane layout only for DeviceList/DeviceMonitoring */}
          <main className="w-full flex-1 min-h-0 p-7">
            {activePage === "DeviceList" || activePage === "DeviceMonitoring" ? (
              <div className="grid grid-cols-[2fr_1fr] w-full h-full gap-3">
                <div className="min-h-0">
                  {renderCenter()}
                </div>
                <StationMapPanel
                  vehiclePosition={vehiclePosition}
                  stationStatusMap={stationStatusMap}
                  className="h-full"
                />
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