// src/components/common/Donut.jsx
import { memo, useMemo } from "react";

export function healthColorForPct(
  pct,
  palette = { ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444" },
  thresholds = { warn: 99, bad: 50 }
) {
  const value = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  if (value >= thresholds.warn) return palette.ok;
  if (value >= thresholds.bad) return palette.warn;
  return palette.bad;
}

const DonutImpl = ({
  value = 0,                      // 0~100
  color,                          // 없으면 healthColorForPct로 자동
  palette,                        // 팔레트 커스터마이즈
  thresholds,                     // 임계 커스터마이즈
  bgTrack = "rgba(148,163,184,0.25)",
  size = 150,
  stroke = 20,
  variant = "svg",                // "svg" | "conic"
  className = "",
  style,
  showValue = true,               // 가운데 숫자 표시 여부
  formatValue = (v) => `${v}%`,   // 가운데 표시 포맷터
  children,                       // 커스텀 중앙 콘텐츠(우선)
  title,                          // hover title
  "aria-label": ariaLabel,
}) => {
  const pct = useMemo(
    () => Math.max(0, Math.min(100, Number(value) || 0)),
    [value]
  );

  const resolvedColor = useMemo(
    () => color || healthColorForPct(pct, palette, thresholds),
    [color, pct, palette, thresholds]
  );

  if (variant === "conic") {
    // conic-gradient는 CSS 커스텀 변수로 부드럽게 전환
    const ringBg = "#1f2a3b";
    return (
      <span
        className={`relative inline-block rotate-180 ${className}`}
        style={{
          "--pct": pct,                       // 0~100
          "--color": resolvedColor,
          "--ring-bg": ringBg,
          width: size,
          height: size,
          borderRadius: "9999px",
          background: `conic-gradient(var(--color) calc(var(--pct) * 1%), var(--ring-bg) 0)`,
          transition: "background 300ms linear",
          ...style,
        }}
        aria-label={ariaLabel ?? `도넛 ${pct}%`}
        title={title ?? `${pct}%`}
        role="img"
      >
        <span
          className="absolute inset-[3px]  rounded-full"
          style={{ background: "#0f172a" }}
        />
        <span className="absolute inset-0 rotate-180 grid place-items-center">
          {children ?? (showValue ? (
            <span className="text-2xl font-semibold" style={{ color: resolvedColor }}>
              {formatValue(pct)}
            </span>
          ) : null)}
        </span>
      </span>
    );
  }

  // SVG variant
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={style}
      aria-label={ariaLabel ?? `도넛 ${pct}%`}
      title={title ?? `${pct}%`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-sm"
      >
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
          stroke={resolvedColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {children ?? (showValue ? (
          <span className="text-2xl font-semibold" style={{ color: resolvedColor }}>
            {formatValue(pct)}
          </span>
        ) : null)}
      </div>
    </div>
  );
};

export const Donut = memo(DonutImpl);
export default Donut;
