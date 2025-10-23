// src/components/Header.jsx
import { useMqttStore } from "../stores/MqttStore";
import { useAuthStore } from "../stores/AuthStore";
import { useInspectStore } from "../stores/InspectStore";
import StartInspectionButton from "./buttons/StartInspectionButton";
import StopInspectionButton from "./buttons/StopInspectionButton";
import { request } from "../services/mqtt/bus";

const START_SYSTEM_CHECK_ID = 123456789;
const STOP_SYSTEM_CHECK_ID = 123456790;

export default function Header({ activePage }) {
  const connected = useMqttStore((s) => s.connected);
  const phase = useInspectStore((s) => s.phase);
  
  // 인증 상태
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const pageMap = {
    Main: ["Main"],
    DeviceList: ["장치 관리"],
    DeviceMonitoring: ["장치 모니터링"],
    Settings: ["설정"],
  };
  const path = pageMap[activePage] || [activePage];

  const handleStart = async () => {
    if (!connected) {
      alert("MQTT가 연결되지 않았습니다.");
      return;
    }
    try {
      const payload = {
        VER: "1.0",
        TS: new Date().toISOString(),
        TRANSACTION_ID: START_SYSTEM_CHECK_ID,
      };
      const resp = await request("startSystemCheck", payload, { timeoutMs: 10000 });

      const code = resp?.data?.CODE ?? resp?.CODE ?? 200;
      const msg = resp?.data?.MSG ?? resp?.MSG ?? "점검 시작 응답 수신";
      if (Number(code) !== 200) {
        console.warn("시작 실패:", code, msg);
        alert(`점검 시작 실패${code ? ` (CODE ${code})` : ""}: ${msg}`);
        return;
      }
      console.log("✅ 점검 시작:", msg);
    } catch (e) {
      console.error("startSystemCheck 실패:", e);
      alert(`점검 시작 실패: ${e.message || e}`);
    }
  };

  const handleStop = async () => {
    try {
      const payload = {
        VER: "1.0",
        TS: new Date().toISOString(),
        TRANSACTION_ID: STOP_SYSTEM_CHECK_ID,
      };
      const resp = await request("stopSystemCheck", payload, { timeoutMs: 10000 });

      const code = resp?.data?.CODE ?? resp?.CODE ?? 200;
      const msg = resp?.data?.MSG ?? resp?.MSG ?? "점검 종료 응답 수신";
      if (Number(code) !== 200) {
        console.warn("중단 실패:", code, msg);
        alert(`점검 중단 실패${code ? ` (CODE ${code})` : ""}: ${msg}`);
        return;
      }
      console.log("🛑 점검 종료:", msg);
    } catch (e) {
      console.error("stopSystemCheck 실패:", e);
      alert(`점검 중단 실패: ${e.message || e}`);
    }
  };

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      logout();
    }
  };

  return (
    <header className="flex h-20 items-center justify-between px-10 pt-10 bg-[#121d2d]">
      <div className="flex items-center space-x-2 text-slate-400 text-lg">
        <img className="w-7" src="public/icons/icon_User.png" alt="user" />
        <div className="text-lg">User: </div>
        <div className="text-lg text-slate-100">{currentUser || "Admin"}</div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-5 text-2xl text-slate-100">
        <StartInspectionButton
          onStart={handleStart}
          className="shadow-sm"
          disabled={!connected || phase !== "idle"}
        />
        <StopInspectionButton
          onStop={handleStop}
          className="shadow-sm"
          disabled={!connected || phase !== "running"}
        />
        <button 
          className="btn btn-text hover:bg-slate-700/50 transition-colors"
          onClick={handleLogout}
        >
          <img className="w-7" src="public/icons/Icon_Logout_Nor.png" alt="logout" />
          <span className="pl-2">로그아웃</span>
        </button>
      </div>
    </header>
  );
}