// src/components/SidebarItem.jsx
import React, { useState } from "react";

export default function SidebarItem({
  icon: Icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  children = [], // [{icon: SubIcon, label: 'Device List', onClick: fn}]
  className = "",
  iconSizeCollapsed = 32,
  iconSizeExpanded = 26,
  labelClassName = "",
  expandedPadding = "px-2 py-2",
  iconColWidth = 48
}) {
  const hasChildren = children && children.length > 0;

  if (collapsed) {
    return (
      <div
        className={`group relative ${className}`}
      >
        <button
          type="button"
          onClick={onClick}
          title={label}
          className={[
            "w-full rounded-lg transition",
            "flex flex-col items-center justify-center py-4",
            active ? "bg-white/10 ring-1 ring-sky-400/40" : "",
          ].join(" ")}
        >
          <Icon
            size={iconSizeCollapsed}
            className={active ? "text-white" : "text-slate-200"}
          />
          <span
            className={[
              "mt-1 h-1.5 w-1.5 rounded-full",
              active ? "bg-sky-400" : "bg-slate-400/50",
            ].join(" ")}
          />
        </button>

        {hasChildren && (
          <div
            className={[
              "absolute left-full top-0 ml-2 z-40",
              "min-w-44 rounded-xl border border-slate-600/60 bg-slate-800/95 shadow-lg p-2",
            ].join(" ")}
            role="menu"
          >
            <p className="px-2 pb-2 text-3xl font-semibold text-slate-300">{label}</p>
            <ul className="space-y-1">
              {children.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="w-full grid grid-cols-[48px_1fr] items-center rounded-lg px-2 py-2 text-left"
                    role="menuitem"
                  >
                    <c.icon size={22} className="justify-self-center text-slate-200" />
                    <span className="text-slate-100 text-3xl">{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── 펼침: 2열 그리드(아이콘 칼럼 48px 고정)로 간격 통일
  return (
    <div className={`w-full ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={[
          "group w-full rounded-lg px-5 py-5 text-left",
          "grid grid-cols-[48px_1fr] items-center gap-3",
          expandedPadding,
          "transition",
          active ? "bg-white/10 ring-1 ring-sky-400/40" : "",
        ].join(" ")}
      >
        <Icon
          size={iconSizeExpanded}
          className={active ? "text-white justify-self-center" : "text-slate-200 justify-self-center"}
        />
        <span className={[
          active ? "text-white text-2xl" : "text-slate-100", 
          labelClassName,
          ].join(" ")}>{label}</span>
      </button>

      {hasChildren && (
        <div className="mt-1 pl-2 space-y-1">
          {children.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={c.onClick}
              className="w-full grid grid-cols-[48px_1fr] items-center gap-3 rounded-lg px-2 py-2"
            >
              <c.icon size={22} className="justify-self-center text-slate-200" />
              <span className="text-slate-100 text-3xl">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
