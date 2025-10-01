// src/App.jsx
import { useState, useMemo, useLayoutEffect } from "react";
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

const DESIGN_W = 2560;
const DESIGN_H = 1400;


function useViewportScale() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const scale = useMemo(() => Math.min(size.w / DESIGN_W, size.h / DESIGN_H), [size.w, size.h]);
  return scale;
}

export default function App() {
  const [activePage, setActivePage] = useState("Main");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scale = useViewportScale();
  
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

          {/* ✅ Page content */}
          <main className="w-full flex-1 min-h-0 p-7">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
}