// pages/Main.jsx
import { Card } from "../components/common/Card";
import MainSystemStats from "../components/MainSystemStats";

export default function Main() {
  return (
    <div
      className="
        h-full
        grid
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
          {/* TODO: jeseo 로그 데이터 객체화 시키기. RSE의 하드웨어 오류나 등록 기기에 대한 응답 타임아웃 등의 통신 오류 로그 정의하기, FMS에 대해서도. */}
          <div className="h-full bg-[#2E3A4E] rounded-xl border border-slate-100 p-6 text-[#9FA9B5] text-sm">
            [250925.094435.304][Warning][TEST_RSE] there's nothing to add!
          </div>
        </Card>
      </div>
    </div>
  );
}
