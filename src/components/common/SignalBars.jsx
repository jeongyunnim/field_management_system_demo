// src/components/SignalBars.jsx
import { memo } from "react";

function SignalBarsImpl({ bars = 1, className = "" }) {
  return (
    <div className={["flex items-end gap-1", className].join(" ")} aria-label={`신호 ${bars}/4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm ${i < bars ? "bg-[#28B555]" : "bg-slate-600"}`}
          style={{ height: `${8 + i * 6}px` }}
        />
      ))}
    </div>
  );
}

export default memo(SignalBarsImpl);