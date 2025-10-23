import { memo, useMemo } from "react";

/**
 * 헬스 퍼센트에 따른 색상 결정
 */
export function getHealthColor(
  percent,
  palette = { ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444" },
  thresholds = { warn: 99, bad: 50 }
) {
  const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  if (value >= thresholds.warn) return palette.ok;
  if (value >= thresholds.bad) return palette.warn;
  return palette.bad;
}

/**
 * SVG 기반 도넛 차트 - 회전 -90도로 12시 방향 시작
 */
function SvgDonut({ value, color, bgTrack, size, stroke, showValue, formatValue, children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-sm"
        style={{ transform: "rotate(-90deg)" }} // SVG만 회전
      >
        {/* 배경 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgTrack}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* 진행 표시 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
      </svg>
      
      {/* 중앙 콘텐츠 - 회전 없음 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span className="text-2xl font-semibold" style={{ color }}>
            {formatValue(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * CSS Conic Gradient 기반 도넛 차트 - 깔끔한 구조
 */
function ConicDonut({ value, color, size, showValue, formatValue, children }) {
  const ringBg = "#1f2a3b";
  const innerBg = "#0f172a";
  const strokeWidth = Math.max(3, size / 10); // 동적 두께

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* 외부 링 - CSS 커스텀 변수 제거, 직접 계산 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            ${color} 0deg,
            ${color} ${value * 3.6}deg,
            ${ringBg} ${value * 3.6}deg,
            ${ringBg} 360deg
          )`,
          transition: "background 300ms ease-out",
        }}
      />
      
      {/* 내부 원 - 도넛 형태 */}
      <div
        className="absolute rounded-full"
        style={{
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          backgroundColor: innerBg,
        }}
      />
      
      {/* 중앙 콘텐츠 */}
      <div className="relative flex items-center justify-center">
        {children || (showValue && (
          <span className="text-2xl font-semibold" style={{ color }}>
            {formatValue(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 메인 Donut 컴포넌트
 */
const DonutImpl = ({
  value = 0,
  color,
  palette,
  thresholds,
  bgTrack = "rgba(148, 163, 184, 0.25)",
  size = 150,
  stroke = 20,
  variant = "svg",
  className = "",
  style,
  showValue = true,
  formatValue = (v) => `${v}%`,
  children,
  title,
  "aria-label": ariaLabel,
}) => {
  // 값 정규화
  const normalizedValue = useMemo(() => {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }, [value]);

  // 색상 결정
  const resolvedColor = useMemo(() => {
    return color || getHealthColor(normalizedValue, palette, thresholds);
  }, [color, normalizedValue, palette, thresholds]);

  const commonProps = {
    value: normalizedValue,
    color: resolvedColor,
    size,
    showValue,
    formatValue,
    children,
  };

  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size, height: size, ...style }}
      role="img"
      aria-label={ariaLabel || `${normalizedValue}%`}
      title={title || `${normalizedValue}%`}
    >
      {variant === "conic" ? (
        <ConicDonut {...commonProps} />
      ) : (
        <SvgDonut {...commonProps} bgTrack={bgTrack} stroke={stroke} />
      )}
    </div>
  );
};

export const Donut = memo(DonutImpl);
export default Donut;