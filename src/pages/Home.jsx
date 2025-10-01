// pages/Home.jsx
import { Card } from "../components/common/Card";
import React from "react";
import MainSystemStats from "../components/MainSystemStats";

export default function Home({
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
        <MainSystemStats />
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="main-card-title">이벤트 리스트 로그</h2>
            </div>
          </div>
          <div className="h-full bg-[#2E3A4E] rounded-xl border border-slate-200 p-6 text-[#9FA9B5] text-sm">
            [250925.094435.304][Warning][TEST_RSE] there's nothing to add!
          </div>
        </Card>
      </div>
    </div>
  );
}
