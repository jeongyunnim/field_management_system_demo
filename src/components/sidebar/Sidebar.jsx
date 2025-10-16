// src/layouts/Sidebar.jsx
import { useState } from "react";
import SidebarStatusPanel from "./SidebarStatusPanelContainer";
import SidebarItem from "./SidebarItem";

export default function Sidebar({ activePage, setActivePage}) {
  const go = (p) => setActivePage(p);

  return (
    <aside
      className={`h-full grid justify-between bg-slate-700 text-slate-100 transition-all duration-300`}
    >
      <div className="relative border-b border-slate-600/40 divide-y-4 ">
        {/* <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute inset-y-0 right-0 inline-flex items-center justify-center"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="pl-4">{isCollapsed ? <ChevronRight size={36} /> : <ChevronLeft size={36} />}</div>
        </button> */}

        <div className="h-full flex items-center justify-center px-4">
          <img
            src="/logo_white.png"
            alt="Dynavista_logo"
            className="w-32"
          />
        </div>
      </div>
      {/* NAV */}
      <nav className="flex-1 px-2 pt-7 space-y-2 text-xl">

        {/* 메인 화면 */}
        <SidebarItem
          imgSrc="/public/icons/Icon_MainDisplay_Sel.png"
          label="메인화면"
          active={activePage === "Main"}
          onClick={() => go("Main")}
        />
        {/* 장치 관리 */}
        <SidebarItem
          imgSrc="/public/icons/Icon_RseDeviceSet_Sel.png"
          label="RSE 장치관리"
          active={activePage === "DeviceList"}
          onClick={() => go("DeviceList")}
        />
        {/* 장치 모니터링 */}
        <SidebarItem
          imgSrc="/public/icons/Icon_RseMonitoring_Sel.png"
          label="RSE 모니터링"
          active={activePage === "DeviceMonitoring"}
          onClick={() => go("DeviceMonitoring")}
        />
        {/* Settings */}
        <SidebarItem
          imgSrc="/public/icons/Icon_Settings_Sel.png"
          label="설정"
          active={activePage === "Settings"}
          onClick={() => go("Settings")}
        />
      </nav>

      {/* 하단 상태 패널 */}
      <div className="pb-2 bg-gradient-to-t from-slate-700 via-slate-700/95 to-transparent flex">
        <SidebarStatusPanel
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
