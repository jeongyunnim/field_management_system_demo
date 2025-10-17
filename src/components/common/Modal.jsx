// src/components/common/Modal.jsx
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,

  // 1) 기존 아이콘 노드 (그대로 지원)
  icon = null,

  // 2) 이미지 소스 기반 아이콘 (새로 추가)
  iconSrc,              // string | import result (ex: /icons/shield.png or import ShieldPng from '...')
  iconAlt = "icon",
  iconSize = 24,        // px
  iconRounded = false,  // true면 둥근 썸네일처럼 렌더링
  iconClassName = "",   // 추가 클래스
  iconInvertOnDark = false, // true면 다크테마에서 invert 적용

  maxWidth = "max-w-xl",
  children,
  footer = null,
}) {
  if (!open) return null;

  const headerIcon = (() => {
    if (icon) return icon; // 우선순위: 기존 리액트 노드
    if (!iconSrc) return null;
    return (
      <img
        src={iconSrc}
        alt={iconAlt}
        width={iconSize}
        height={iconSize}
        className={[
          "shrink-0",
          iconRounded ? "rounded-full" : "rounded",
          iconInvertOnDark ? "dark:invert" : "",
          iconClassName,
        ].join(" ").trim()}
        style={{ width: iconSize, height: iconSize, objectFit: "contain" }}
      />
    );
  })();

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={`w-full ${maxWidth} rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-slate-100 font-semibold flex items-center gap-2">
              {headerIcon}
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 text-slate-100"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">{children}</div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/10 flex justify-end">
            {footer ?? (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
