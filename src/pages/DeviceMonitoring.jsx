// src/pages/DeviceMonitoring.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useMqttStore } from "../stores/MqttStore";
import { saveV2XMessage, msgDb } from "../deprecated/v2x_msg_db";
import { updateMessageCount, countDb } from "../deprecated/v2x_count_db";
import { saveGnssData, gnssDb } from "../deprecated/gnss_db";
import { Card } from "../components/common/Card";
import MonitoringDeviceList from "../components/monitor/MonitoringDeviceList";
import StationMapPanel from "../components/monitor/StationMapPanel";
import { BookDashed, BookCheck, ShieldOff, ShieldCheck, RefreshCcw, Layers as DummyIcon } from "lucide-react";
import SystemResourcePanel from "../deprecated/SystemResourcePanel";
import Led from "../components/common/Led";
import SignalBars from "../components/common/SignalBars";
import { rssiToBars } from "../utils/signal";

// const snrBars = rssiToBars(selected?.rssi);

export default function DeviceMonitoring({ onStatusUpdate }) {
  const [loading, setLoading] = useState(false);
  const [stationStatusMap, setStationStatusMap] = useState({});
  const [selected, setSelected] = useState(null); // <- 클릭된 항목

  const handleStatusUpdate = (l2id, status) => {
    setStationStatusMap((prev) => ({ ...prev, [l2id]: status }));
    onStatusUpdate?.(l2id, status);
  };

  return (
    <div className="grid w-full h-full">
      {/* 좌: 요약 + 리스트 */}
      <Card className="p-4 overflow-hidden flex flex-col min-h-0">
        <div className="flex items-start justify-between mb-3">
          <h2 className="main-card-title">장치 모니터링</h2>
          <div className="flex gap-2" >
          <button className="btn-sm btn-text-sm inline-flex items-center gap-1" onClick={() => seedDemoData({ stations: 10 })} disabled={loading} title="더미 데이터 추가">
              <DummyIcon size={16} /> 더미 데이터
            </button>
            <button className="btn-sm btn-text-sm inline-flex items-center gap-1" onClick={async () => {
              const ok = window.confirm("DB 초기화할까요?");
              if (!ok) return;
              setLoading(true);
              try { await msgDb.messages.clear(); await countDb.counts.clear(); await gnssDb.gnssData.clear(); setStationStatusMap({}); setSelected(null); }
              finally { setLoading(false); }
            }} disabled={loading} title="DB 초기화">
              <RefreshCcw size={16} /> 초기화
            </button>
          </div>
        </div>

        {/* 상단 비주얼 요약 */}
        <SummaryPanel selected={selected} />

        {/* 하단 리스트(클릭 → 위 패널 갱신) */}
        <div className="mt-4 min-h-0">
          <MonitoringDeviceList
            className="h-full"
            selectedId={selected?.l2id}
            onSelect={(it) => setSelected(it)}
          />
        </div>
      </Card>
    </div>
  );
}

/* ================== 상단 요약 패널 ================== */
function SummaryPanel({ selected }) {
  if (!selected) {
    return (
      <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/60 p-4">
        <div className="text-slate-400">하단 목록을 클릭하면 상세정보가 표시됩니다.</div>
      </div>
    );
  }
  const okPct = selected.hwHealth ?? 72;
  const badPct = Math.max(0, 100 - okPct);
  const snrBars = rssiToBars(selected.rssi);

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/80 p-4 text-slate-300 text-sm">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* 좌: 기본 정보 + LED */}
        <div className="flex items-center gap-2 col-span-4 justify-between">
          <div className="flex items-center gap-4">
            <Led on={!!selected.active} />
            <div className="px-2 py-1.5 rounded-lg bg-[#0f172a] ring-1 ring-white/10 text-slate-200 w-40">
              {selected.serial}
            </div>
          </div>
        </div>
        <div className="col-start-6 col-span-5 flex items-end gap-1 mb-2" aria-label="신호 세기">
          <SignalBars bars={snrBars} />
          <span className="ml-2">60 dBm</span>
        </div>
        <div className="col-span-2 device-inspection-icon-btn bg-rose-900/90">
          <span>재부팅</span>
        </div>
        
        <div className="flex justify-between col-span-12 space-x-2">
          {/* 맵 데이터 업데이트 */}
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>MAP Data 업데이트</span>
          </div>
          {/* 장치 제어 */}
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>장치제어(SNMP)</span>
          </div>
          {/* sw 업데이트 */}
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>S/W 업데이트</span>
          </div>
          {/* 디버그 정보 */}
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>디버그 정보 저장</span>
          </div>
        </div>
        
        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>물리 보안</span>
          <ShieldCheck size={50}/>
          <span>적용 중</span>
        </div>
        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>인증서</span>
          <BookCheck size={50}/>
          <span>D-4</span>
        </div>

        {/* 중: H/W 상태 도넛 + 모듈 배지 */}
        <div className="col-span-4 row-span-2 flex items-center justify-center gap-4">
          <div className="relative w-36 h-36">
            <div
              className="absolute inset-0 rounded-full rotate-180"
              style={{ background: `conic-gradient(#28B555 0 ${okPct}%, #FF4D4D 0 ${okPct + badPct}%)` }}
              aria-label="HW health"
              title={`정상 ${okPct}% / 주의 ${badPct}%`}
            />
            <div className="absolute inset-[10px] rounded-full bg-[#0f172a]" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-slate-200 text-2xl font-semibold">{okPct}%</span>
            </div>
          </div>
        </div>
      <SystemResourcePanel />
      </div>
    </div>
  );
}
