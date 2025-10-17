import { useState, useMemo, useEffect } from "react";
import { Card } from "../components/common/Card";
import MonitoringDeviceList from "../components/monitor/MonitoringDeviceList";
import { BookCheck, ShieldCheck, ShieldOff, CircleX } from "lucide-react";
import SystemResourcePanel from "../components/monitor/SystemResourcePanel";
import Led from "../components/common/Led";
import SignalBars from "../components/common/SignalBars";
import { useMetricsStore } from "../stores/MetricsStore";
import { Info } from "lucide-react";
import HealthIssuesModal from "../components/monitor/HealthIssuesModal";
import CertificateModal from "../components/monitor/CertificateModal";
import DebugInfoModal from "../components/monitor/DebugInfoModal";
import Donut from "../components/common/Donut";

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
      <Card className="p-4 overflow-hidden gap-2">
        <div className="flex items-start justify-between mb-3">
          <h2 className="main-card-title">장치 모니터링</h2>
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
        <MonitoringDeviceList
          selectedId={selectedId}
          onSelect={(it) => {
            // it: { id (serial), ... } — 리스트 아이템
            setSelected(it.id);      // 전역 선택ID(누적 시계열 바인딩은 이 값으로)
            setSelectedLocal(it);    // 요약 패널은 아이템 객체 그대로 사용
          }}
        />
      </Card>
    </div>
  );
}

/* ================== 상단 요약 패널 ================== */
function SummaryPanel({ selected, series, latest }) {
  const [openIssues, setOpenIssues] = useState(false);
  const [openCert, setOpenCert] = useState(false);
  const [openDebug, setOpenDebug] = useState(false);
  const setWarning = useMetricsStore((s) => s.setWarning);

  const health = selected?.health;
  const okPct =
    (health && typeof health === "object")
      ? Number(health.healthPct ?? health.pct ?? 0)
      : (Number.isFinite(health) ? Number(health) : 0);
  
  useEffect(() => {
    if (!selected?.id) return;
    const valid = Number.isFinite(okPct);
    const isWarn = valid ? okPct !== 100 : false;
    setWarning(selected.id, isWarn);
  }, [selected?.id, okPct, setWarning]);

  if (!selected) {
    return (
      <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/60 p-4">
        <div className="text-slate-400">하단 목록을 클릭하면 상세정보가 표시됩니다.</div>
      </div>
    );
  }

  const badPct = Math.max(0, 100 - okPct);
  const snrBars = Number.isFinite(selected?.bars) ? selected.bars : 0;

  // TODO: 차후 데이터 시트 변경되면 실제 RSSI 값으로 변경해야 함.
  const dbm = Number.isFinite(selected?.rssiDbm) ? selected.rssiDbm : null;
  const dday = Number.isFinite(selected?.certDaysLeft) ? selected.certDaysLeft : null;
  const FALLBACK_LABELS = {
    gnssAntenna: "GNSS 안테나",
    lteAntenna1: "LTE-V2X 안테나1",
    lteAntenna2: "LTE-V2X 안테나2",
    v2xUsb: "V2X USB",
    v2xSpi: "V2X SPI",
    sramVbat: "SRAM VBAT",
    ppsSync: "1PPS 동기",
    cpuOk: "CPU 사용률",
    memOk: "메모리 사용률",
    diskOk: "스토리지 사용률",
    tempOk: "온도",
  };

  const tamperOn = !!selected?.__raw?.tamper_secure_status;  // 물리보안 적용중?
  const certExpired = dday == null ? true : dday < 0;         // 만료/정보없음 → 위험 처리

  // --- 공통 스타일
  const baseTile = "h-36 col-span-2 device-inspection-icon-btn transition-colors";
  const okTile = "bg-emerald-900/90 ring-1 ring-emerald-500/30";
  const warnTile = "bg-yellow-900/90 ring-1";

  function deriveIssues(h) {
    if (!h) return [];
    if (Array.isArray(h.issues) && h.issues.length > 0) return h.issues;
    const flags = h.flags && typeof h.flags === "object" ? h.flags : null;
    if (!flags) return [];
    return Object.entries(flags)
      .filter(([_, v]) => v === false)       // 실패한 불리언만
      .map(([k]) => FALLBACK_LABELS[k] || k) // 라벨 매핑
  }

  const issues = deriveIssues(health);
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
          <span className="ml-2">{dbm != null ? `${dbm} dBm` : "-"}</span>
        </div>

        {/* 액션 버튼들 */}
        <div className="col-span-2 device-inspection-icon-btn bg-rose-900/90">
          <span>재부팅</span>
        </div>
        <div className="flex justify-between col-span-12 space-x-2">
          <button className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>MAP Data 업데이트</span>
          </button>
          <button className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>장치제어(SNMP)</span>
          </button>
          <button className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>S/W 업데이트</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenDebug(true)}
            className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90"
            title="전체 정보 보기/저장"
          >  
            <span>디버그 정보 저장</span>
          </button>
        </div>

        {/* 카드들 */}
        {(() => {
          // 물리보안 (그대로)
          const SecurityIcon = tamperOn ? ShieldCheck : ShieldOff;

          // 1) 활성 여부: ltev2x_cert_status_security_enable 최우선
          const rawEnable = selected?.__raw?.ltev2x_cert_status_security_enable;
          const certEnabled =
            rawEnable === true || rawEnable === 1 || rawEnable === "1" ||
            rawEnable === "Y" || rawEnable === "y";

          // 2) D-day: 활성일 때만 의미 있음
          const d = certEnabled ? (Number.isFinite(dday) ? dday : null) : null;

          // 3) 상태 결정: disabled | ok | expired | unknown(활성인데 D-day없음)
          const certState = !certEnabled
            ? "disabled"
            : (d == null ? "unknown" : (d >= 0 ? "ok" : "expired"));

          // 4) 매핑(아이콘/색/라벨)
          const TileBy  = { ok: okTile, expired: warnTile, disabled: warnTile, unknown: warnTile };
          const IconBy  = { ok: BookCheck, expired: CircleX, disabled: CircleX, unknown: CircleX };
          const labelBy = {
            ok:      `D-${d}`,
            expired: `만료 ${-d}일`,
            disabled:"비활성화",
            unknown: "정보 없음",
          };
          const titleBy = {
            ok:      "인증서 유효",
            expired: `인증서 만료 ${-d}일 — 조치 필요`,
            disabled:"인증서 비활성화 — 조치 필요",
            unknown: "인증서 D-day 정보 없음 — 조치 필요",
          };

          const CertIcon = IconBy[certState];

          return (
            <>
              {/* 물리 보안 */}
              <button
                className={`${baseTile} ${tamperOn ? okTile : warnTile}`}
                title={tamperOn ? "물리 보안: 적용 중" : "물리 보안: 비활성 — 조치 필요"}
                aria-live="polite"
              >
                <span>물리 보안</span>
                <SecurityIcon size={50} />
                <span>
                  {tamperOn ? "적용 중" : "미적용"}
                </span>
              </button>

              {/* 인증서 */}
              <button
                type="button"
                onClick={() => setOpenCert(true)}
                className={`${baseTile} ${TileBy[certState]}`}
                title={titleBy[certState]}
                aria-live="polite"
              >
                <span>인증서</span>
                <CertIcon size={50} />
                <span>{labelBy[certState]}</span>
              </button>
            </>
          );
        })()}

        {/* Health 도넛 */}
        <button 
          type="button"
          className="col-span-4 row-span-2 flex items-center justify-center gap-4"
          onClick={() => setOpenIssues(true)}
          aria-label="비정상 항목 보기"
          title="비정상 항목 보기">
          <div className="relative w-36 h-36">
            <Donut
              value={okPct}
              variant="conic"
              size={144}
              stroke={18}
              className=""
              title={`정상 ${okPct}%`}
              aria-label="current status"
              formatValue={(v) => `${v}%`}              
            />
            <span className="text-[10px] w-42 h-10 text-slate-400">* 상세 정보를 보려면 클릭하세요</span>
          </div>
        </button>
        <SystemResourcePanel 
          cpuSeries={series?.cpu ?? []}
          emmcSeries={series?.emmc ?? []}
          ramSeries={series?.ram ?? []}
          cpuValue={latest?.cpu}
          emmcValue={latest?.emmc}
          ramValue={latest?.ram}
        />
      </div>
      <HealthIssuesModal
        open={openIssues}
        onClose={() => setOpenIssues(false)}
        issues={issues}
        title="정상 상태가 아닌 항목"
      />

      <CertificateModal
        open={openCert}
        onClose={() => setOpenCert(false)}
        certificate={selected?.__raw?.certificate ?? selected?.certificate}
        certDaysLeft={selected?.certDaysLeft}
      />

      <DebugInfoModal
        open={openDebug}
        onClose={() => setOpenDebug(false)}
        selected={selected}
      />
    </div>
  );
}
