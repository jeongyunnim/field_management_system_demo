// src/layouts/Sidebar.jsx (중요 부분만)
import { useState } from "react";
import SidebarStatusPanel from "./SidebarStatusPanelContainer";
import { LayoutDashboard, Monitor, Server, Wifi, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SidebarItem from "./SidebarItem";

export default function Sidebar({ activePage, setActivePage, isCollapsed, setIsCollapsed }) {
  const [open, setOpen] = useState({ monitoring: true });
  const go = (p) => setActivePage(p);
  const toggle = (k) => setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  const isMonitoringActive = ["DeviceList", "WirelessDevices"].includes(activePage);

  return (
    <aside
      className={`${
        isCollapsed ? "w-1/8" : "w-1/6"
      } h-full bg-slate-700 text-slate-100 transition-all duration-300 flex flex-col`}
    >
      <div className="relative border-b border-slate-600/40">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute inset-y-0 right-0 inline-flex items-center justify-center"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="pl-4">{isCollapsed ? <ChevronRight size={36} /> : <ChevronLeft size={36} />}</div>
        </button>

        <div className="h-24 flex items-center justify-center px-4">
          <img
            src="/logo_white.png"
            alt="DYNAVISTA"
            className={isCollapsed ? "w-20 p-2" : "w-32"}
          />
        </div>
      </div>
      {/* NAV */}
      <nav className="flex-1 px-2 space-y-1.5 text-lg">

        {/* Home */}
        <SidebarItem
          icon={LayoutDashboard}
          label="Home"
          active={activePage === "Home"}
          collapsed={isCollapsed}
          onClick={() => go("Home")}
        />
        {/* 장치 관리 */}
        <SidebarItem
          icon={Server}
          label="장치 관리"
          active={activePage === "DeviceList"}
          collapsed={isCollapsed}
          onClick={() => go("DeviceList")}
        />
        {/* 장치 모니터링 */}
        <SidebarItem
          icon={Wifi}
          label="장치 모니터링"
          active={activePage === "DeviceMonitoring"}
          collapsed={isCollapsed}
          onClick={() => go("DeviceMonitoring")}
        />
        {/* Settings */}
        <SidebarItem
          icon={Settings}
          label="설정"
          active={activePage === "Settings"}
          collapsed={isCollapsed}
          onClick={() => go("Settings")}
        />
      </nav>

      {/* 하단 상태 패널 */}
      <div className="pb-2 bg-gradient-to-t from-slate-700 via-slate-700/95 to-transparent">
        <SidebarStatusPanel
          isCollapsed={isCollapsed}
          v2xReady={false}
          freqMHz={5850}
          bwMHz={10}
          txCount={123456}
          rxCount={987654} 
          gnss={{ fix: "3D-FIX", lat: 35.905806, lon: 126.520896 }}
        />
      </div>
    </aside>
  );
}
