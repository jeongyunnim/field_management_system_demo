// src/components/StartInspectionButton.jsx
import React, { useEffect, useRef, useState } from "react";

export default function StartInspectionButton({
  onStart,
  className = "",
  disabled = false,
  onBegan,
}) {

  const handleClick = () => {
    if (disabled) return;
    onStart?.();
    onBegan?.();
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          className={[
            "relative inline-flex items-center btn justify-center select-none font-semibold transition",
            "btn-text",
            disabled
              ? "bg-slate-600 text-white/90 cursor-not-allowed opacity-70"
              : "bg-[#28B555] text-white",
            "shadow-sm ring-1 ring-emerald-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            className,
          ].join(" ")}
          aria-disabled={disabled}
        >
          <span className={[
            "absolute left-5 top-1/2 -translate-y-1/2 rounded-full w-3.5 h-3.5",
            disabled ? "bg-white/50" : "bg-white/90",
          ].join(" ")} />
          <span className="ml-2 pointer-events-none mx-auto whitespace-nowrap tracking-tight">
            점검 시작
          </span>
        </button>
      </div>
    </>
  );
}
