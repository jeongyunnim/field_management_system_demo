// src/components/StopInspectionButton.jsx
import React, { useEffect, useRef, useState } from "react";

export default function StopInspectionButton({
  onStop,
  className = "",
  disabled = false,
  onEnded,
}) {
  const toastTimerRef = useRef(null);

  const confirmAndStop = () => {
    if (!window.confirm("점검을 중단하시겠습니까?")) return;
    onStop?.();
    onEnded?.();
  };

  const handleClick = () => { if (!disabled) confirmAndStop(); };

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          className={[
            "relative inline-flex btn items-center justify-center select-none rounded-xl font-semibold transition",
            "btn-text",
            disabled
              ? "bg-slate-600 text-white/90 cursor-not-allowed opacity-70"
              : "bg-rose-600 text-white",
            "shadow-sm ring-1 ring-rose-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            className,
          ].join(" ")}
          aria-disabled={disabled}
        >
          <span className={[
            "absolute left-5 top-1/2 -translate-y-1/2 rounded-full w-3.5 h-3.5 bg-white/90",
            disabled ? "" : "animate-pulse",
          ].join(" ")}/>
          <span className="ml-2 pointer-events-none mx-auto whitespace-nowrap tracking-tight">
            점검 중단
          </span>
        </button>
      </div>
    </>
  );
}
