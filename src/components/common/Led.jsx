// src/components/Led.jsx
import { memo } from "react";

function LedImpl({ on }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full shadow-inner ring-1 ${
        on ? "bg-emerald-500 ring-emerald-300/40 animate-pulse" : "bg-slate-500 ring-slate-300/30"
      }`}
      aria-label={on ? "활성" : "비활성"}
    />
  );
}

export default memo(LedImpl);