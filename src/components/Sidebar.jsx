// src/layouts/Sidebar.jsx (중요 부분만)
import { useState } from "react";
import SidebarStatusPanel from "../components/SidebarStatusPanel";
import { LayoutDashboard, Monitor, Server, Wifi, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SidebarItem from "../components/SidebarItem";

export default function Sidebar({ activePage, setActivePage, isCollapsed, setIsCollapsed }) {
  const [open, setOpen] = useState({ monitoring: true });
  const go = (p) => setActivePage(p);
  const toggle = (k) => setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  const isMonitoringActive = ["DeviceList", "WirelessDevices"].includes(activePage);

  return (
    <aside
      className={`${
        isCollapsed ? "w-44" : "w-1/5"
      } bg-slate-700 text-slate-100 transition-all duration-300`}
    >
      <div className="grid h-screen grid-rows-[auto,1fr,auto] text-3xl">
        {/* 헤더 */}
        <div className={`flex items-center justify-between h-64 px-3`}>
          {!isCollapsed && (
            <img src="/logo_white.png" alt="DYNAVISTA" className="mx-auto block h-auto object-contain" />
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 -mr-1">
            {isCollapsed ? <ChevronRight size={36} /> : <ChevronLeft size={36} />}
          </button>
        </div>

        {/* NAV */}
        <nav className="overflow-y-auto px-2 py-3 space-y-1.5">

          {/* Main */}
          <SidebarItem
            icon={LayoutDashboard}
            label="Main"
            active={activePage === "Main"}
            collapsed={isCollapsed}
            onClick={() => go("Main")}
            iconSizeCollapsed={56}
            iconSizeExpanded={50}
            iconColWidth={56}
            labelClassName="text-4xl"
            expandedPadding="px-4 py-3.5"
            collapsedPadding="px-3.5 py-3"
          />

          {/* Monitoring (토글) */}
          <SidebarItem
            icon={Monitor}
            label="Monitoring"
            active={isMonitoringActive}
            collapsed={isCollapsed}
            onClick={() => toggle("monitoring")}
            iconSizeCollapsed={56}
            iconSizeExpanded={50}
            iconColWidth={56}
            labelClassName="text-4xl"
            expandedPadding="px-4 py-3.5"
            collapsedPadding="px-3.5 py-3"
          />

          {/* 하위 메뉴 (접힘/펼침 공통) */}
          <AnimatePresence>
            {open.monitoring && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={isCollapsed ? "mt-1 space-y-1" : "mt-1 pl-3 space-y-1"}
              >
                <SidebarItem
                  icon={Server}
                  label="Device List"
                  labelClassName="text-2xl"
                  active={activePage === "DeviceList"}
                  collapsed={isCollapsed}
                  onClick={() => go("DeviceList")}
                  iconSizeCollapsed={56}
                  iconSizeExpanded={50}
                  iconColWidth={56}
                  expandedPadding="px-4 py-2.5"
                  collapsedPadding="px-3.5 py-2.5"
                />
                <SidebarItem
                  icon={Wifi}
                  label="Wireless Devices"
                  labelClassName="text-2xl"
                  active={activePage === "WirelessDevices"}
                  collapsed={isCollapsed}
                  onClick={() => go("WirelessDevices")}
                  iconSizeCollapsed={56}
                  iconSizeExpanded={50}
                  iconColWidth={56}
                  expandedPadding="px-4 py-2.5"
                  collapsedPadding="px-3.5 py-2.5"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings */}
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={activePage === "Settings"}
            collapsed={isCollapsed}
            onClick={() => go("Settings")}
            iconSizeCollapsed={56}
            iconSizeExpanded={50}
            iconColWidth={56}
            labelClassName="text-4xl"
            expandedPadding="px-4 py-3.5"
            collapsedPadding="px-3.5 py-3"
          />
        </nav>

        {/* 하단 상태 패널 */}
        <div className="px-2 pb-2 pt-3 bg-gradient-to-t from-slate-700 via-slate-700/95 to-transparent">
          <SidebarStatusPanel
            isCollapsed={isCollapsed}
            v2xReady={true}
            freqMHz={5850}
            bwMHz={10}
            txCount={123456}
            rxCount={987654}
            gnss={{ fix: "3D-FIX", lat: 35.905806, lon: 126.520896, headingDeg: 92.48, speedKmh: 60 }}
          />
        </div>
      </div>
    </aside>
  );
}
