// src/components/Header.jsx
import { useState } from "react";
import { useMqttStore } from "../stores/MqttStore";
import { useAuthStore } from "../stores/AuthStore";
import { useInspectStore } from "../stores/InspectStore";
import StartInspectionButton from "./buttons/StartInspectionButton";
import StopInspectionButton from "./buttons/StopInspectionButton";
import { request, ensureInitialized, isInitialized } from "../services/mqtt/bus";
import { generateTransactionId } from "../utils/deviceUtils";
import { stopSystemCheck } from "../services/mqtt/inspectionController";

export default function Header({ activePage }) {
  const connected = useMqttStore((s) => s.connected);
  const phase = useInspectStore((s) => s.phase);
  const [isStarting, setIsStarting] = useState(false);
  
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
    // 중복 클릭 방지
    if (isStarting) {
      console.log("점검 시작 요청 처리 중...");
      return;
    }

    setIsStarting(true);

    try {
      // 1. MQTT 연결 확인
      if (!connected) {
        alert("MQTT가 연결되지 않았습니다.\\n재연결 버튼을 클릭하거나 잠시 후 다시 시도하세요.");
        return;
      }

      // 2. 버스 초기화 확인 및 자동 초기화
      if (!isInitialized()) {
        console.log("MQTT 버스 초기화 중...");
        
        try {
          await ensureInitialized();
          console.log("✅ MQTT 버스 초기화 완료");
        } catch (error) {
          console.error("❌ MQTT 버스 초기화 실패:", error);
          alert(`MQTT 버스 초기화 실패: ${error.message}\\n페이지를 새로고침하거나 관리자에게 문의하세요.`);
          return;
        }
      }

      // 3. 점검 시작 요청
      const payload = {
        VER: "1.0",
        TS: new Date().toISOString(),
        TRANSACTION_ID: generateTransactionId(),
      };

      console.log("점검 시작 요청 전송 중...");
      const resp = await request("startSystemCheck", payload, { timeoutMs: 10000 });

      const code = resp?.CODE ?? 0;
      const msg = resp?.MSG ?? "점검 시작 응답 수신";
      
      console.log(`응답 CODE: ${code}, MSG: ${msg}`);
      
      if (Number(code) !== 200) {
        console.warn("시작 실패:", code, msg);
        alert(`점검 시작 실패${code ? ` (CODE ${code})` : ""}: ${msg}`);
        return;
      }
      
      console.log("✅ 점검 시작 성공:", msg);
    } catch (error) {
      console.error("❌ startSystemCheck 실패:", error);
      
      // 에러 메시지 개선
      let errorMessage = "점검 시작 중 오류가 발생했습니다.";
      
      if (error.message?.includes("Timeout")) {
        errorMessage = "FMS 응답 시간 초과\\n네트워크 상태를 확인하거나 잠시 후 다시 시도하세요.";
      } else if (error.message?.includes("not initialized")) {
        errorMessage = "MQTT 버스가 초기화되지 않았습니다.\\n페이지를 새로고침하세요.";
      } else if (error.message?.includes("not connected")) {
        errorMessage = "MQTT 연결이 끊어졌습니다.\\n재연결 후 다시 시도하세요.";
      } else {
        errorMessage = `점검 시작 실패: ${error.message || error}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopSystemCheck();
      console.log("✅ 점검 종료");
    } catch (error) {
      console.error("❌ 점검 종료 실패:", error);
      alert(`점검 종료 실패: ${error.message || error}`);
    }
  };

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      logout();
    }
  };

  // 점검 시작 버튼 비활성화 조건
  const isStartDisabled = !connected || phase !== "idle" || isStarting;

  return (
    <header className="flex h-20 items-center justify-between px-10 pt-10 bg-[#121d2d]">
      <div className="flex items-center space-x-2 text-slate-400 text-lg">
        <img className="w-7" src="public/icons/icon_User.png" alt="user" />
        <div className="text-lg">User: </div>
        <div className="text-lg text-slate-100">{currentUser || "Admin"}</div>
      </div>

      <div className="flex items-center space-x-5 text-2xl text-slate-100">
        <StartInspectionButton
          onStart={handleStart}
          className="shadow-sm"
          disabled={isStartDisabled}
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