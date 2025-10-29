// src/components/buttons/StartInspectionButton.jsx
import React from "react";
import { useMqttStore } from "../../stores/MqttStore";
import { useInspectStore } from "../../stores/InspectStore";
import { useVmStatusStore } from "../../stores/VmStatusStore";

export default function StartInspectionButton({
  onStart,
  onReconnect,
  onReset,  // 초기화 콜백 추가
  className = "",
  disabled = false,
  onBegan,
}) {
  // MQTT 연결 상태
  const mqttConnected = useMqttStore((state) => state.connected);
  const mqttReconnect = useMqttStore((state) => state.reconnect);
  const v2xReady = useVmStatusStore((state) => state.parsed?.v2xReady ?? null);
  
  // 점검 상태
  const inspectPhase = useInspectStore((state) => state.phase);

  // 재연결 모드 여부
  const isReconnectMode = !mqttConnected;
  
  // 초기화 모드 여부 (점검 완료 또는 에러 상태)
  const isResetMode = !isReconnectMode && 
                       mqttConnected && 
                       (inspectPhase === "completed" || inspectPhase === "error");

  // 버튼 비활성화 조건
  const isDisabled = (() => {
    if (disabled) return true;
    
    // 재연결 모드: 항상 활성화 (MQTT 재연결이 최우선)
    if (isReconnectMode) return false;
    
    // 초기화 모드: 항상 활성화
    if (isResetMode) return false;
    
    // 정상 모드: idle 상태이고 v2xReady가 true일 때만 활성화
    return inspectPhase !== "idle" || !v2xReady;
  })();

  const handleClick = () => {
    if (isDisabled) return;
    
    if (isReconnectMode) {
      // 재연결 모드: MQTT 재연결 시도
      if (onReconnect) {
        onReconnect();
      } else if (mqttReconnect) {
        mqttReconnect();
      }
    } else if (isResetMode) {
      // 초기화 모드: 점검 상태 리셋
      onReset?.();
    } else {
      // 정상 모드: 점검 시작
      onStart?.();
      onBegan?.();
    }
  };

  // 버튼 스타일
  const buttonColor = (() => {
    if (isReconnectMode) return "bg-orange-500 hover:bg-orange-600";
    if (isResetMode) return "bg-gray-600 hover:bg-gray-700";
    return "bg-[#2B7FFF] hover:bg-blue-600";
  })();

  const buttonText = (() => {
    if (isReconnectMode) return "재연결";
    if (isResetMode) return "초기화";
    return "점검 시작";
  })();

  const indicatorColor = (() => {
    if (isReconnectMode) return "bg-white/90 animate-pulse"; // 깜빡임
    if (isResetMode) return "bg-white/70";
    return "bg-white/90";
  })();

  const tooltipText = (() => {
    if (isReconnectMode) return "MQTT 연결이 끊어졌습니다. 클릭하여 재연결하세요.";
    if (isResetMode) return "점검을 초기화하고 다시 시작할 수 있습니다.";
    if (inspectPhase === "requesting") return "점검 시작 요청 중...";
    if (inspectPhase === "running") return "점검 진행 중";
    if (inspectPhase === "stopping") return "점검 종료 중...";
    if (!v2xReady) return "V2X 준비 대기 중...";
    return "점검을 시작합니다";
  })();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        className={[
          "relative inline-flex items-center btn justify-center select-none font-semibold transition",
          "btn-text",
          isDisabled
            ? "bg-slate-600 text-white/90 cursor-not-allowed opacity-70"
            : buttonColor + " text-white",
          "shadow-sm ring-1 ring-emerald-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          className,
        ].join(" ")}
        aria-disabled={isDisabled}
        title={tooltipText}
      >
        {/* 상태 인디케이터 */}
        <span
          className={[
            "absolute left-5 top-1/2 -translate-y-1/2 rounded-full w-3.5 h-3.5",
            isDisabled ? "bg-white/50" : indicatorColor,
          ].join(" ")}
        />
        
        {/* 버튼 텍스트 */}
        <span className="ml-3 pointer-events-none mx-auto whitespace-nowrap tracking-tight">
          {buttonText}
        </span>
      </button>

      {/* 연결 상태 툴팁 */}
      {isReconnectMode && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-orange-500 font-medium">
            ⚠️ 연결 끊김
          </span>
        </div>
      )}
      
      {/* 초기화 모드 툴팁 */}
      {isResetMode && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-gray-500 font-medium">
            🔄 다시 시작
          </span>
        </div>
      )}
    </div>
  );
}