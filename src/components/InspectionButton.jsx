// src/components/InspectionButton.jsx
import React, { useEffect, useRef, useState } from "react";

export default function InspectionButton({
  initial = false,
  onStart,
  onStop,
  toastDuration = 2000,
  widthClass = "w-40",
  heightClass = "h-10",
  className = "",
}) {
  const [isInspecting, setIsInspecting] = useState(initial);
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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const startInspection = () => {
    setIsInspecting(true);
    onStart?.();
    showToast("점검이 시작되었습니다.");
  };

  const requestStopInspection = () => {
    if (!window.confirm("점검을 중단하시겠습니까?")) return;
    setIsInspecting(false);
    setHovering(false);
    onStop?.();
    showToast("점검이 중단되었습니다.");
  };

  const handleClick = () => (isInspecting ? requestStopInspection() : startInspection());
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const label = !isInspecting ? "점검 시작" : hovering ? "점검 중단" : "점검 중";

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => isInspecting && setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`relative flex items-center justify-center select-none rounded-lg font-medium transition
            ${widthClass} ${heightClass}
            ${isInspecting ? "bg-red-600 text-white" : "bg-green-600 text-white"}
            ${className}`}
        >
          <span className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-full
            ${isInspecting ? "w-2.5 h-2.5 bg-white/90 animate-pulse" : "w-2.5 h-2.5 bg-white/80"}`} />
          <span className="pointer-events-none mx-auto whitespace-nowrap text-sm text-center overflow-hidden text-ellipsis">
            {label}
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
