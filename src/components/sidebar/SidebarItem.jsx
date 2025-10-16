// src/components/SidebarItem.jsx
import React, { useState } from "react";

export default function SidebarItem({
  label,
  active = false,
  onClick,
  className = "",
  imgSrc = "",
  labelClassName = "",
}) {

  return (
    <div className={`w-full ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={[
          "group w-full rounded-lg px-5 py-2 text-left",
          "grid grid-cols-[48px_1fr] items-center",
          "transition",
          active ? "bg-white/10" : "",
        ].join(" ")}
      >
        <img
          src={imgSrc}
          alt="sidebar icon"
          className={active ? "w-7 text-white justify-self-center" : "w-7 text-slate-200 justify-self-center"}
        />
        <span className={[
          active ? "text-white" : "text-slate-100", 
          labelClassName,
          ].join(" ")}>{label}</span>
      </button>
    </div>
  );
}
