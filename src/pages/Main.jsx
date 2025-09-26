// pages/Main.jsx
import StatCard from "../components/StatCard";
import React from "react";
import SystemStatsCard from "../components/SystemStatsCard";

export default function Main({
  status = "normal",
  sidebarWidth = 280,
  headerHeight = 160,
}) {
  return (
    <div
      style={{ "--sidebar-w": `${sidebarWidth}px`, "--header-h": `${headerHeight}px` }}
      className="min-h-0 text-white"
    >
      <section className="h-[calc(100dvh-var(--header-h))] overflow-auto px-12 py-12">
        <div
          className="
            mx-auto w-full grid gap-7 h-full 2xl:gap-8
            grid-rows-[5fr_5fr_1fr]
          "
        >
          <SystemStatsCard />
          <Card className="">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-4xl font-semibold">이벤트 리스트 로그</h2>
                <p className="text-2xl text-slate-500 mt-1">(기본 : 장애 로그)</p>
              </div>
            </div>
            <div className="h-full bg-[#2E3A4E] rounded-xl border border-slate-200 p-6 text-[#9FA9B5] text-2xl">
              [250925.094435.304][Warning][TEST_RSE] there's nothing to add!
            </div>
          </Card>
          <Card className="">
            <div className="flex flex-row text-4xl font-semibold items-center">
              <h3 className="mr-10">현장관리 단말기 상태</h3> 
              {status === "normal" ? (
                <span className="inline-block h-8 w-36 rounded-full bg-[#32E36C] shadow animate-pulse" />
              ) : (
                <span className="inline-block h-6 w-6 rounded-full bg-rose-500 shadow" />
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

export function Card({ className = "", children }) {
  return (
    <section
      className={[
        "flex flex-col",
        "bg-[#121D2D] text-slate-100",
        "relative rounded-2xl shadow-sm",
        "ring-1 ring-[#576476] p-7 2xl:p-8",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
