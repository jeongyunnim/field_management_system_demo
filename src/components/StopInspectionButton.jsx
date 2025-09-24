// src/components/StopInspectionButton.jsx
import React, { useEffect, useRef, useState } from "react";

export default function StopInspectionButton({
  onStop,
  toastDuration = 2000,
  widthClass = "w-40",
  heightClass = "h-10",
  className = "",
  disabled = false, // isInspecting이 false면 true로 전달
  onEnded, // 중단되면 부모에 알림 (isInspecting=false)
}) {
  const [hovering, setHovering] = useState(false);
  const [toast, setToast] = useState({ visible: false, text: "" });
  const toastTimerRef = useRef(null);

  const showToast = (text) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, text });
    toastTimerRef.current = setTimeout(() => {
      setToast({ visible: false, text: "" });
      toastTimerRef.current = null;
    }, toastDuration);
  };

  useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), []);

  const confirmAndStop = () => {
    if (!window.confirm("점검을 중단하시겠습니까?")) return;
    onStop?.();
    onEnded?.(); // 부모 isInspecting=false
    showToast("점검이 중단되었습니다.");
  };

  const handleClick = () => {
    if (disabled) return;
    confirmAndStop();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`relative flex items-center justify-center select-none rounded-lg font-medium transition
            ${widthClass} ${heightClass}
            ${disabled ? "bg-red-300 text-white cursor-not-allowed opacity-70" : "bg-red-600 text-white hover:bg-red-700"}
            ${className}`}
          aria-disabled={disabled}
        >
          <span
            className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-full w-2.5 h-2.5
              ${disabled ? "bg-white/50" : "bg-white/90 animate-pulse"}`}
          />
          <span className="pointer-events-none mx-auto whitespace-nowrap text-sm text-center overflow-hidden text-ellipsis">
            점검 중단
          </span>
        </button>
      </div>

      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-neutral-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast.text}
        </div>
      )}
    </>
  );
}
