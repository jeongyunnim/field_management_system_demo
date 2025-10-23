import React, { useMemo, useEffect } from "react";
import { shallow } from "zustand/shallow";
import { BookCheck, ShieldCheck, ShieldOff, CircleX } from "lucide-react";

// Stores
import { useInspectStore } from "../stores/InspectStore";
import { useMetricsStore } from "../stores/MetricsStore";
import { useRseStore } from "../stores/RseStore";
import { useModalStore } from "../stores/ModalStore";

// Components
import MonitoringDeviceList from "../components/monitor/MonitoringDeviceList";
import SystemResourcePanel from "../components/monitor/SystemResourcePanel";
import HealthIssuesModal from "../components/monitor/HealthIssuesModal";
import CertificateModal from "../components/monitor/CertificateModal";
import DebugInfoModal from "../components/monitor/DebugInfoModal";
import { Card } from "../components/common/Card";
import SignalBars from "../components/common/SignalBars";
import Led from "../components/common/Led";
import Donut from "../components/common/Donut";

// Services & Utils
import { getDirectSession, publishDirect, rpcDirect } from "../services/mqtt/directPool";
import { extractDeviceIp, toISOWithLocalOffset, generateTransactionId } from "../utils/deviceUtils";
import { getHealthPercent } from "../utils/formatUtils";
import { calculateCertDaysLeft } from "../utils/certificateUtils";
import { MQTT_TOPICS, HEALTH_CHECK_LABELS, TILE_STYLES, CERT_STATES } from "../constants/appConstants";

/**
 * 장치 모니터링 메인 컴포넌트
 */
export default function DeviceMonitoring() {
  const phase = useInspectStore((s) => s.phase);
  const setSelected = useMetricsStore((s) => s.setSelected);

  // Stale 감시 시작/종료
  useEffect(() => {
    useRseStore.getState().startStaleWatcher(10, 1000);
    return () => useRseStore.getState().stopStaleWatcher();
  }, []);

  // 점검 중단 시 선택 초기화
  useEffect(() => {
    if (phase !== "running") {
      setSelected(null);
    }
  }, [phase, setSelected]);

  // 선택된 장치 정보
  const selectedId = useMetricsStore((s) => s.selectedId);
  const selected = useRseStore((s) => (selectedId ? s.byId[selectedId] : null), shallow);
  const seriesById = useMetricsStore((s) => s.seriesById);
  const latestById = useMetricsStore((s) => s.latestById);

  // 시계열 데이터
  const selectedSeries = useMemo(() => {
    const row = seriesById?.[selectedId] || {};
    return {
      cpu: Array.isArray(row.cpu) ? row.cpu : [],
      emmc: Array.isArray(row.emmc) ? row.emmc : [],
      ram: Array.isArray(row.ram) ? row.ram : [],
    };
  }, [seriesById, selectedId]);

  // 최신 값
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
      <Card className="p-4 overflow-hidden gap-2">
        <div className="flex items-start justify-between mb-3">
          <h2 className="main-card-title">장치 모니터링</h2>
        </div>

        {/* 상단 비주얼 요약 */}
        <SummaryPanel selected={selected} series={selectedSeries} latest={latest} />

        {/* 하단 리스트 */}
        <MonitoringDeviceList
          selectedId={selectedId}
          onSelect={(item) => setSelected(item.id)}
        />
      </Card>
    </div>
  );
}

/* ================== 상단 요약 패널 ================== */
function SummaryPanel({ selected, series, latest }) {
  // Zustand 모달 스토어 사용
  const modals = useModalStore((state) => state.modals);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  
  const setWarning = useMetricsStore((s) => s.setWarning);

  // 헬스 퍼센트 계산
  const healthPercent = getHealthPercent(selected?.health);

  // 경고 상태 업데이트
  useEffect(() => {
    if (!selected?.id) return;
    const isValid = Number.isFinite(healthPercent);
    const hasWarning = isValid ? healthPercent !== 100 : false;
    setWarning(selected.id, hasWarning);
  }, [selected?.id, healthPercent, setWarning]);

  // 인증서 남은 일수 계산 (실시간 계산)
  const certDaysLeft = useMemo(() => {
    const cert = selected?.__raw?.certificate;
    if (!cert) return null;
    return calculateCertDaysLeft(cert);
  }, [selected?.__raw?.certificate]);

  // 신호 관련 데이터 (selected에서 가져오되 없으면 기본값)
  const signalData = useMemo(() => {
    return {
      bars: Number.isFinite(selected?.bars) ? selected.bars : 0,
      rssiDbm: Number.isFinite(selected?.rssiDbm) ? selected.rssiDbm : null,
    };
  }, [selected?.bars, selected?.rssiDbm]);

  // 선택된 장치가 없거나 비활성
  if (!selected || !selected.active) {
    return (
      <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/60 p-4">
        <div className="text-slate-400">
          하단 목록을 클릭하면 상세정보가 표시됩니다.
        </div>
      </div>
    );
  }

  // 물리보안 상태
  const isTamperOn = !!selected?.__raw?.tamper_secure_status;

  /**
   * 물리보안 토글 핸들러
   */
  async function handleTamperToggle() {
    const nextState = !isTamperOn;
    const topic = nextState ? MQTT_TOPICS.TAMPER_ENABLE : MQTT_TOPICS.TAMPER_DISABLE;
    const message = nextState
      ? "물리 보안을 적용하시겠습니까? (장치가 재부팅 됩니다)"
      : "물리 보안을 해제하시겠습니까?";

    if (!window.confirm(message)) return;

    try {
      const deviceIp = extractDeviceIp(selected.__raw);
      if (!deviceIp) {
        throw new Error("장치의 LTE-V2X IP를 찾을 수 없습니다.");
      }

      const payload = {
        VER: "1.0",
        TRANSACTION_ID: generateTransactionId(),
        TS: toISOWithLocalOffset(),
      };

      await publishDirect({
        pktOrIp: deviceIp,
        topic,
        payload,
        qos: 1,
      });

      console.log("Tamper toggle success");
      alert("요청 전송 완료");
    } catch (error) {
      console.error("Tamper toggle failed:", error);
      alert(`전송 실패: ${error?.message || error}`);
    }
  }

    async function handleRebootBtn() {
    const reqTopic = MQTT_TOPICS.REBOOT_REQ;
    const resTopic = MQTT_TOPICS.REBOOT_RES;
    const message = "장치를 재부팅 하시겠습니까?";

    console.log("=== Reboot Debug ===");
    console.log("Request Topic:", reqTopic);
    console.log("Response Topic:", resTopic);

    if (!window.confirm(message)) 
      return;

    try {
      const deviceIp = extractDeviceIp(selected.__raw);
      if (!deviceIp) {
        throw new Error("장치의 LTE-V2X IP를 찾을 수 없습니다.");
      }

      console.log("Device IP:", deviceIp);

      const payload = {
        VER: "1.0",
        TRANSACTION_ID: generateTransactionId(),
        REASON: "Maintenance reboot",
      };

      console.log("Payload:", payload);

      // rpcDirect 대신 직접 rpcJson 호출 시도
      const session = await getDirectSession(deviceIp);
      await session.rpcJson({
        reqTopic, 
        resTopic,
        payload,
        match: (e) => {
          console.log("=== Match function called ===");
          console.log("Response received:", e);
          
          if (e?.CODE === 200) {
            alert(`[RSE Message] ${e?.MSG || '재부팅 성공'}`);
            return true;
          }
          
          console.warn("Match failed - CODE:", e?.CODE);
          alert(`재부팅 실패: ${e?.MSG || 'Unknown error'}`);
          return false;
        },
        timeoutMs: 10000, // timeout 늘리기
        qos: 1,
      });

    } catch (error) {
      console.error("Reboot failed:", error);
      alert(`전송 실패: ${error?.message || error}`);
    }
  }
  // 헬스 이슈 추출
  const issues = extractHealthIssues(selected?.health);

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/80 p-4 text-slate-300 text-sm">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* 기본 정보 */}
        <div className="flex items-center gap-2 col-span-4 justify-between">
          <div className="flex items-center gap-4">
            <Led on={!!selected.active} />
            <div className="px-2 py-1.5 rounded-lg bg-[#0f172a] ring-1 ring-white/10 text-slate-200 w-40">
              {selected.serial}
            </div>
          </div>
        </div>

        {/* 신호 세기 */}
        <div className="col-start-6 col-span-5 flex items-end gap-1 mb-2" aria-label="신호 세기">
          <SignalBars bars={signalData.bars} />
          <span className="ml-2">
            {signalData.rssiDbm != null ? `${signalData.rssiDbm} dBm` : "-"}
          </span>
        </div>

        {/* 재부팅 버튼 */}
        <div type="button" onClick={handleRebootBtn} className="col-span-2 device-inspection-icon-btn bg-rose-900/90">
          <span>재부팅</span>
        </div>

        {/* 액션 버튼들 */}
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
            onClick={() => openModal("debug")}
            className="w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90"
            title="전체 정보 보기/저장"
          >
            <span>디버그 정보 저장</span>
          </button>
        </div>

        {/* 물리보안 & 인증서 타일 */}
        <SecurityTiles
          isTamperOn={isTamperOn}
          onTamperToggle={handleTamperToggle}
          certificate={selected?.__raw?.certificate}
          certDaysLeft={certDaysLeft}
          onCertClick={() => openModal("certificate")}
        />

        {/* Health 도넛 */}
        <button
          type="button"
          className="col-span-4 row-span-2 flex items-center justify-center gap-4"
          onClick={() => openModal("healthIssues")}
          aria-label="비정상 항목 보기"
          title="비정상 항목 보기"
        >
          <div className="relative w-36 h-36">
            <Donut
              value={healthPercent}
              variant="conic"
              size={144}
              stroke={18}
              title={`정상 ${healthPercent}%`}
              aria-label="current status"
              formatValue={(v) => `${v}%`}
            />
            <span className="text-[10px] w-42 h-10 text-slate-400">
              * 상세 정보를 보려면 클릭
            </span>
          </div>
        </button>

        {/* 시스템 리소스 패널 */}
        <SystemResourcePanel
          cpuSeries={series?.cpu ?? []}
          emmcSeries={series?.emmc ?? []}
          ramSeries={series?.ram ?? []}
          cpuValue={latest?.cpu}
          emmcValue={latest?.emmc}
          ramValue={latest?.ram}
        />
      </div>

      {/* 모달들 - Zustand로 상태 관리 */}
      <HealthIssuesModal
        open={modals.healthIssues}
        onClose={() => closeModal("healthIssues")}
        issues={issues}
        title="정상 상태가 아닌 항목"
      />

      <CertificateModal
        open={modals.certificate}
        onClose={() => closeModal("certificate")}
        certificate={selected?.__raw?.certificate}
        certDaysLeft={certDaysLeft}
        pktOrIp={selected?.__raw}
      />

      <DebugInfoModal
        open={modals.debug}
        onClose={() => closeModal("debug")}
        selected={selected}
      />
    </div>
  );
}

/* ================== 물리보안 & 인증서 타일 ================== */
function SecurityTiles({ isTamperOn, onTamperToggle, certificate, certDaysLeft, onCertClick }) {
  // 물리보안 아이콘
  const SecurityIcon = isTamperOn ? ShieldCheck : ShieldOff;

  // 인증서 상태 결정
  const certState = determineCertState(certificate, certDaysLeft);
  const certConfig = getCertConfig(certState, certDaysLeft);

  return (
    <>
      {/* 물리보안 타일 */}
      <button
        className={`${TILE_STYLES.BASE} ${isTamperOn ? TILE_STYLES.OK : TILE_STYLES.WARN}`}
        title={isTamperOn ? "물리 보안: 적용 중" : "물리 보안: 비활성 — 조치 필요"}
        onClick={onTamperToggle}
        aria-live="polite"
      >
        <span>물리 보안</span>
        <SecurityIcon size={50} />
        <span>{isTamperOn ? "적용 중" : "미적용"}</span>
      </button>

      {/* 인증서 타일 */}
      <button
        type="button"
        onClick={onCertClick}
        className={`${TILE_STYLES.BASE} ${certConfig.tileClass}`}
        title={certConfig.title}
        aria-live="polite"
      >
        <span>인증서</span>
        <certConfig.Icon size={50} />
        <span>{certConfig.label}</span>
      </button>
    </>
  );
}

/* ================== 헬퍼 함수 ================== */

/**
 * 헬스 체크에서 이슈 추출
 */
function extractHealthIssues(health) {
  if (!health) return [];

  // 이미 이슈 배열이 있으면 반환
  if (Array.isArray(health.issues) && health.issues.length > 0) {
    return health.issues;
  }

  // flags 객체에서 실패한 항목 추출
  const flags = health.flags && typeof health.flags === "object" ? health.flags : null;
  if (!flags) return [];

  return Object.entries(flags)
    .filter(([_, value]) => value === false)
    .map(([key]) => HEALTH_CHECK_LABELS[key] || key);
}

/**
 * 인증서 상태 결정
 */
function determineCertState(certificate, daysLeft) {
  if (!certificate) return CERT_STATES.UNKNOWN;

  const rawEnable = certificate.ltev2x_cert_status_security_enable;
  const isEnabled =
    rawEnable === true ||
    rawEnable === 1 ||
    rawEnable === "1" ||
    rawEnable === "Y" ||
    rawEnable === "y";

  if (!isEnabled) return CERT_STATES.DISABLED;
  if (daysLeft == null) return CERT_STATES.UNKNOWN;
  return daysLeft >= 0 ? CERT_STATES.OK : CERT_STATES.EXPIRED;
}

/**
 * 인증서 상태에 따른 UI 설정 반환
 */
function getCertConfig(state, daysLeft) {
  const configs = {
    [CERT_STATES.OK]: {
      Icon: BookCheck,
      tileClass: TILE_STYLES.OK,
      label: `D-${daysLeft}`,
      title: "인증서 유효",
    },
    [CERT_STATES.EXPIRED]: {
      Icon: CircleX,
      tileClass: TILE_STYLES.WARN,
      label: `만료 ${-daysLeft}일`,
      title: `인증서 만료 ${-daysLeft}일 — 조치 필요`,
    },
    [CERT_STATES.DISABLED]: {
      Icon: CircleX,
      tileClass: TILE_STYLES.WARN,
      label: "비활성화",
      title: "인증서 비활성화 — 조치 필요",
    },
    [CERT_STATES.UNKNOWN]: {
      Icon: CircleX,
      tileClass: TILE_STYLES.WARN,
      label: "정보 없음",
      title: "인증서 D-day 정보 없음 — 조치 필요",
    },
  };

  return configs[state];
}