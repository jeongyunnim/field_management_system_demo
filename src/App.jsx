// src/App.jsx
import { useState, useEffect } from "react";
import mqtt from "mqtt";
import { useMqttStore } from "./stores/MqttStore";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Main from "./pages/Main";
import DeviceList from "./pages/DeviceList.jsx";
import RegisterDevice from "./pages/RegisterDevice.jsx";
import EditDevice from "./pages/EditDevice.jsx";
import WirelessDevices from "./pages/WirelessDevices";
import V2XTest from "./pages/V2XTest.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activePage, setActivePage] = useState("Main");
  const [isCollapsed, setIsCollapsed] = useState(false);

  /**
   *  MQTT 초기화
   */
  // const connect = useMqttStore((s) => s.connect);
  // const disconnect = useMqttStore((s) => s.disconnect)

  // useEffect(() => {
  //   connect();
  //   return () => disconnect();
  // }, [connect, disconnect]);

  const renderPage = () => {
    switch (activePage) {
      case "Main":
        return <Main />;
      case "DeviceList":
        return <DeviceList setActivePage={setActivePage} />;
      case "RegisterDevice":
        return <RegisterDevice setActivePage={setActivePage} />;
      case "EditDevice":
        return <EditDevice setActivePage={setActivePage} />;
      case "WirelessDevices":
        return <WirelessDevices />;
      case "V2XTest":
        return <V2XTest />;
      case "Settings":
        return <Settings />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div>
      <div className="flex min-h-[100dvh] text-black">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <Header
            activePage={activePage}
          />

          {/* ✅ Page content */}
          <main className="flex-1 bg-[#0f172a] p-6 overflow-auto">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
}
