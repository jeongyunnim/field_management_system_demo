// src/components/Donut.jsx
import { memo, useMemo } from "react";

export function healthColorForPct(pct, palette = { ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444" }) {
  const value = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  if (value >= 75) return palette.ok;
  if (value >= 50) return palette.warn;
  return palette.bad;
}

const DonutImpl = ({
  value = 0,
  color,
  bgTrack = "rgba(148,163,184,0.25)",
  size = 150,
  stroke = 20,
  variant = "svg", // "svg" | "conic"
}) => {
  const pct = useMemo(() => Math.max(0, Math.min(100, value)), [value]);

  if (variant === "conic") {
    const ringBg = "#1f2a3b";
    return (
      <span
        className="relative inline-block rotate-180"
        style={{
          width: size,
          height: size,
          borderRadius: "9999px",
          background: `conic-gradient(${color || "#22c55e"} ${pct}%, ${ringBg} 0)`,
        }}
        aria-label={`도넛 ${pct}%`}
        title={`${pct}%`}
      >
        <span
          className="absolute inset-[3px] rounded-full"
          style={{ background: "#0f172a" }}
        />
      </span>
    );
  }

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="relative place-items-center ">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bgTrack}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color || "#22c55e"}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-5xl font-bold" style={{ color: color || "#22c55e" }}>{pct}%</span>
      </div>
    </div>
  );
};

export const Donut = memo(DonutImpl);

export default Donut;


