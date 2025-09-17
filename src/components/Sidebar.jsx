import { useState } from "react";
import {
  LayoutDashboard,
  Bell,
  Monitor,
  Map,
  MessageCircle,
  Settings,
  Activity,
  Plug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  MapPinned,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({
  activePage,
  setActivePage,
  isCollapsed,
  setIsCollapsed
}) {
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleClick = (page) => {
    setActivePage(page);
  };

  const [open, setOpen] = useState({
    events: false,
    monitoring: false
  });

  const toggle = (menu) =>
    setOpen((prev) => ({ ...prev, [menu]: !prev[menu] }));

  return (
    <aside
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-gray-800 p-4 text-sm text-white transition-all duration-300`}
    >
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-14">
        {!isCollapsed && (
          <h1 className="text-2xl font-bold text-green-400">DVT V2X Hub</h1>
        )}
        <button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* NAVIGATION 라벨 */}
      {!isCollapsed && (
        <div className="mb-3 px-1">
          <span className="text-xs font-semibold text-gray-400 tracking-wide cursor-default select-none">
            NAVIGATION
          </span>
        </div>
      )}

      <nav className="space-y-6">
        {/* Dashboard */}
        <a
          onClick={() => handleClick("Dashboard")}
          className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
        >
          <LayoutDashboard size={18} />
          <span
            className={`${
              isCollapsed ? "hidden" : "inline"
            } text-base md:text-lg`}
          >
            Dashboard
          </span>
        </a>
        {/* Events */}
        <button
          onClick={() => toggle("events")}
          className="flex items-center justify-between w-full hover:text-green-300"
        >
          <div className="flex items-center space-x-2">
            <Bell size={18} />
            <span
              className={`${
                isCollapsed ? "hidden" : "inline"
              } text-base md:text-lg`}
            >
              Events
            </span>
          </div>
          {open.events ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {/* Events.Notification */}
        <AnimatePresence>
          {open.events && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`${
                isCollapsed ? "" : "ml-6"
              } mt-2 space-y-2 text-base md:text-lg`}
            >
              <a
                onClick={() => handleClick("Notification")}
                className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
              >
                <AlertCircle size={16} />
                <span className={`${isCollapsed ? "hidden" : "inline"}`}>
                  Notification
                </span>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Monitoring */}
        <button
          onClick={() => toggle("monitoring")}
          className="flex items-center justify-between w-full hover:text-green-300"
        >
          <div className="flex items-center space-x-2">
            <Monitor size={18} />
            <span
              className={`${
                isCollapsed ? "hidden" : "inline"
              } text-base md:text-lg`}
            >
              Monitoring
            </span>
          </div>
          {open.monitoring ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>
        {/* Monitoring.Subs */}
        <AnimatePresence>
          {open.monitoring && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`${
                isCollapsed ? "" : "ml-6"
              } mt-2 space-y-2 text-base md:text-lg`}
            >
              {/* Monitoring.Device List */}
              <a
                onClick={() => handleClick("DeviceList")}
                className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
              >
                <HardDrive size={16} />
                <span className={`${isCollapsed ? "hidden" : "inline"}`}>
                  Device List
                </span>
              </a>
              {/* Monitoring.Dashboard */}
              <a
                onClick={() => handleClick("WirelessDevices")}
                className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
              >
                <HardDrive size={16} />
                <span className={`${isCollapsed ? "hidden" : "inline"}`}>
                  Wireless Devices
                </span>
              </a>
              {/* Monitoring.Map */}
              <a
                onClick={() => handleClick("MapView")}
                className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
              >
                <MapPinned size={16} />
                <span className={`${isCollapsed ? "hidden" : "inline"}`}>
                  Map view
                </span>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Messages */}
        <a
          onClick={() => handleClick("Messages")}
          className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
        >
          <MessageCircle size={18} />
          <span
            className={`${
              isCollapsed ? "hidden" : "inline"
            } text-base md:text-lg`}
          >
            Messages
          </span>
        </a>
        {/* V2X Test */}
        <a
          onClick={() => handleClick("V2XTest")}
          className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
        >
          <Activity size={18} />
          <span
            className={`${
              isCollapsed ? "hidden" : "inline"
            } text-base md:text-lg`}
          >
            V2X Test
          </span>
        </a>
        {/* Settings */}
        <a
          onClick={() => handleClick("Settings")}
          className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
        >
          <Settings size={18} />
          <span
            className={`${
              isCollapsed ? "hidden" : "inline"
            } text-base md:text-lg`}
          >
            Settings
          </span>
        </a>
        {/* Extension Store */}
        <a
          onClick={() => handleClick("ExtensionStore")}
          className="flex items-center space-x-2 hover:text-green-300 cursor-pointer"
        >
          <Plug size={18} />
          <span
            className={`${
              isCollapsed ? "hidden" : "inline"
            } text-base md:text-lg`}
          >
            Extension Store
          </span>
        </a>
      </nav>
    </aside>
  );
}
