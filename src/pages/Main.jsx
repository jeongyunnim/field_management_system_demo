// pages/Main.jsx
import StatCard from "../components/StatCard";
import { Card } from "../components/Card";
import React from "react";
import SystemStatsCard from "../components/SystemStatsCard";

export default function Main({
  status = "normal",}) {
  return (
    <div
      className="
        h-full
        grid gap-7
        grid-rows-[5fr]
      "
    >
      <div className="grid gap-7 grid-cols-2">
        <SystemStatsCard />
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-3xl font-semibold">이벤트 리스트 로그</h2>
            </div>
          </div>
          <div className="h-full bg-[#2E3A4E] rounded-xl border border-slate-200 p-6 text-[#9FA9B5] text-sm">
            [250925.094435.304][Warning][TEST_RSE] there's nothing to add!
          </div>
        </Card>
      </div>
      {/* <Card>
        <div className="flex flex-row text-3xl font-semibold items-center">
          <h3 className="mr-10">현장관리 단말기 상태</h3> 
          {status === "normal" ? (
            <span className="inline-block h-8 w-36 rounded-full bg-[#32E36C] shadow animate-pulse" />
          ) : (
            <span className="inline-block h-6 w-6 rounded-full bg-rose-500 shadow" />
          )}
        </div>
      </Card> */}
    </div>
  );
}
