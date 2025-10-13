import { useState, useMemo } from "react";
import { Card } from "../components/common/Card";
import MonitoringDeviceList from "../components/monitor/MonitoringDeviceList";
import { BookCheck, ShieldCheck, RefreshCcw } from "lucide-react";
import SystemResourcePanel from "../components/monitor/SystemResourcePanel";
import Led from "../components/common/Led";
import SignalBars from "../components/common/SignalBars";
import { useMetricsStore } from "../stores/MetricsStore";

export default function DeviceMonitoring() {
  const [loading, setLoading] = useState(false);
  const [selected, setSelectedLocal] = useState(null); // 요약 패널 표시용(선택된 아이템 객체)

  // 전역 선택ID + 누적 시계열 + 최신값
  const selectedId = useMetricsStore((s) => s.selectedId);
  const seriesById = useMetricsStore((s) => s.seriesById);
  const latestById = useMetricsStore((s) => s.latestById);
  const setSelected = useMetricsStore((s) => s.setSelected);

  const selectedSeries = useMemo(() => {
    const row = seriesById?.[selectedId] || {};
    return {
      cpu: Array.isArray(row.cpu) ? row.cpu : [],
      emmc: Array.isArray(row.emmc) ? row.emmc : [],
      ram: Array.isArray(row.ram) ? row.ram : [],
    };
  }, [seriesById, selectedId]);

  const latest = useMemo(() => {
    const l = latestById?.[selectedId] || {};
    return {
      cpu: Number.isFinite(l.cpu) ? l.cpu : null,
      emmc: Number.isFinite(l.emmc) ? l.emmc : null,
      ram: Number.isFinite(l.ram) ? l.ram : null,
    };
  }, [latestById, selectedId]);

  return (
    <div className="grid w-full h-full">
      {/* 좌: 요약 + 리스트 */}
      <Card className="p-4 overflow-hidden flex flex-col min-h-0">
        <div className="flex items-start justify-between mb-3">
          <h2 className="main-card-title">장치 모니터링</h2>
          <div className="flex gap-2">
            <button
              className="btn-sm btn-text-sm inline-flex items-center gap-1"
              onClick={async () => {
                const ok = window.confirm("DB 초기화할까요?");
                if (!ok) return;
                setLoading(true);
                try {
                  console.log("DB 초기화");
                } catch (e) {
                  console.error(e);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              title="DB 초기화"
            >
              <RefreshCcw size={16} /> DB 초기화
            </button>
          </div>
        </div>

        {/* 상단 비주얼 요약 */}
        <SummaryPanel
          selected={selected}
          series={{
            cpu: selectedSeries.cpu,
            emmc: selectedSeries.emmc,
            ram: selectedSeries.ram,
          }}
          latest={{
            cpu: latest.cpu,
            emmc: latest.emmc,
            ram: latest.ram,
          }}
        />

        {/* 하단 리스트(클릭 → 위 패널/요약 갱신) */}
        <div className="mt-4 min-h-0">
          <MonitoringDeviceList
            className="h-full"
            selectedId={selectedId}
            onSelect={(it) => {
              // it: { id (serial), ... } — 리스트 아이템
              setSelected(it.id);      // 전역 선택ID(누적 시계열 바인딩은 이 값으로)
              setSelectedLocal(it);    // 요약 패널은 아이템 객체 그대로 사용
            }}
          />
        </div>
      </Card>
    </div>
  );
}

/* ================== 상단 요약 패널 ================== */
function SummaryPanel({ selected, series, latest }) {
  if (!selected) {
    return (
      <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/60 p-4">
        <div className="text-slate-400">하단 목록을 클릭하면 상세정보가 표시됩니다.</div>
      </div>
    );
  }
  const okPct = Number.isFinite(selected.health) ? selected.health : 0;
  const badPct = Math.max(0, 100 - okPct);
  const snrBars = selected.bars ?? 0;
  const dbm = (typeof selected.signalDbm === "number") ? selected.signalDbm : null;
  const dday = selected.certDaysLeft ?? null;

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

        {/* 신호 */}
        <div className="col-start-6 col-span-5 flex items-end gap-1 mb-2" aria-label="신호 세기">
          <SignalBars bars={snrBars} />
          <span className="ml-2">{dbm != null ? `${dbm} dBm` : "-"}</span>
        </div>

        {/* 임의 버튼 */}
        <div className="col-span-2 device-inspection-icon-btn bg-rose-900/90">
          <span>재부팅</span>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex justify-between col-span-12 space-x-2">
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>MAP Data 업데이트</span>
          </div>
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>장치제어(SNMP)</span>
          </div>
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>S/W 업데이트</span>
          </div>
          <div className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>디버그 정보 저장</span>
          </div>
        </div>

        {/* 카드들 */}
        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>물리 보안</span>
          <ShieldCheck size={50} />
          <span>{selected.__raw?.tamper_secure_status ? "적용 중" : "미적용"}</span>
        </div>

        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>인증서</span>
          <BookCheck size={50} />
          <span>
            {dday != null ? (dday >= 0 ? `D-${dday}` : `만료 ${-dday}일`) : "정보 없음"}
          </span>
        </div>

        {/* Health 도넛 */}
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
        <SystemResourcePanel 
          cpuSeries={series?.cpu ?? []}
          emmcSeries={series?.emmc ?? []}
          ramSeries={series?.ram ?? []}
          cpuValue={latest?.cpu}
          emmcValue={latest?.emmc}
          ramValue={latest?.ram}
        />
      </div>
    </div>
  );
}
