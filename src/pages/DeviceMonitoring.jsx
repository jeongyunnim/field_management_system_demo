// src/pages/DeviceMonitoring.jsx
import React, { useMemo, useEffect, useRef } from "react";
import { shallow } from "zustand/shallow";
import { BookCheck, ShieldCheck, ShieldOff, CircleX } from "lucide-react";

// Stores
import { useInspectStore } from "../stores/InspectStore";
import { useMetricsStore } from "../stores/MetricsStore";
import { useRseStore } from "../stores/RseStore";
import { useModalStore } from "../stores/ModalStore";
import { useOtaStore } from "../stores/OtaStore";

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
import { readFileAsText, selectFile } from "../utils/fileUtils";

// OTA Services
import { 
  checkDeviceVersion, 
  performUpdate
} from "../services/ota/otaService";

/**
 * 장치 모니터링 메인 컴포넌트
 */
export default function DeviceMonitoring() {
  const phase = useInspectStore((s) => s.phase);
  const setSelected = useMetricsStore((s) => s.setSelected);

  // 이미 체크한 디바이스 ID 추적
  const checkedDevicesRef = useRef(new Set());

  // Stale 감시 시작/종료
  useEffect(() => {
    useRseStore.getState().startStaleWatcher(10, 1000);
    return () => useRseStore.getState().stopStaleWatcher();
  }, []);

  // 점검 중단 시 선택 초기화
  useEffect(() => {
    if (phase !== "running") {
      setSelected(null);
      checkedDevicesRef.current.clear();
    }
  }, [phase, setSelected]);

  // 선택된 장치 정보
  const selectedId = useMetricsStore((s) => s.selectedId);
  const selected = useRseStore((s) => (selectedId ? s.byId[selectedId] : null), shallow);
  const seriesById = useMetricsStore((s) => s.seriesById);
  const latestById = useMetricsStore((s) => s.latestById);

  // 선택된 디바이스가 바뀔 때만 OTA 버전 체크
  useEffect(() => {
    if (!selected?.id || !selected.active) return;

    const deviceId = selected.id;
    const deviceIp = extractDeviceIp(selected.__raw);
    
    if (!deviceIp) return;

    // 이미 체크한 디바이스는 스킵
    if (checkedDevicesRef.current.has(deviceId)) {
      return;
    }

    console.log(`[OTA] Checking version for device: ${deviceId}`);
    checkedDevicesRef.current.add(deviceId);
    
    checkDeviceVersion(deviceId, deviceIp).catch((error) => {
      console.error(`[OTA] Failed to check version for ${deviceId}:`, error);
      checkedDevicesRef.current.delete(deviceId);
    });
  }, [selected?.id, selected?.active]);

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
        <SummaryPanel 
          selected={selected} 
          series={selectedSeries} 
          latest={latest}
          checkedDevicesRef={checkedDevicesRef}
        />

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
function SummaryPanel({ selected, series, latest, checkedDevicesRef }) {
  const modals = useModalStore((state) => state.modals);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  
  const setWarning = useMetricsStore((s) => s.setWarning);

  // OTA 상태 가져오기
  const deviceStatus = useOtaStore((s) => s.deviceStatus[selected?.id]);
  const isUpdating = useOtaStore((s) => s.isUpdating);
  const hasOtaPackages = useOtaStore((s) => s.localIndex !== null); // ⭐ DB에 OTA 패키지 존재 여부

  // 장치 IP 확인
  const deviceIp = selected ? extractDeviceIp(selected.__raw) : null;
  const hasDeviceIp = !!deviceIp;

  // 헬스 퍼센트 계산
  const healthPercent = getHealthPercent(selected?.health);

  // 경고 상태 업데이트
  useEffect(() => {
    if (!selected?.id) return;
    const isValid = Number.isFinite(healthPercent);
    const hasWarning = isValid ? healthPercent !== 100 : false;
    setWarning(selected.id, hasWarning);
  }, [selected?.id, healthPercent, setWarning]);

  // 인증서 남은 일수 계산
  const certDaysLeft = useMemo(() => {
    const cert = selected?.__raw?.certificate;
    if (!cert) return null;
    return calculateCertDaysLeft(cert);
  }, [selected?.__raw?.certificate]);

  // 신호 관련 데이터
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
    if (!hasDeviceIp) {
      alert("장치의 IP 주소를 찾을 수 없습니다.");
      return;
    }

    const nextState = !isTamperOn;
    const topic = nextState ? MQTT_TOPICS.TAMPER_ENABLE : MQTT_TOPICS.TAMPER_DISABLE;
    const message = nextState
      ? "물리 보안을 적용하시겠습니까? (장치가 재부팅 됩니다)"
      : "물리 보안을 해제하시겠습니까?";

    if (!window.confirm(message)) return;

    try {
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

  async function handleMapDataUpdateBtn() {
    if (!hasDeviceIp) {
      alert("장치의 IP 주소를 찾을 수 없습니다.");
      return;
    }

    const reqTopic = MQTT_TOPICS.MAP_UPDATE_REQ;
    const resTopic = MQTT_TOPICS.MAP_UPDATE_RES;
    const message = "MAP 데이터를 업데이트 하시겠습니까?";
    
    if (!window.confirm(message)) 
      return;

    try {
      const file = await selectFile({
        description: "MAP 데이터 파일"
      });

      if (!file) return;

      const mapDataContent = await readFileAsText(file);
      
      if (!mapDataContent || mapDataContent.trim() === "") {
        throw new Error("MAP 데이터 파일이 비어있습니다.");
      }

      console.log("MAP data size:", mapDataContent.length, "bytes");

      const transactionId = generateTransactionId();
      
      const payload = {
        header: {
          ack: 1,
          transactionId: transactionId,
          ver: "1.0"
        },
        param: {
          data_type: 2,
          index: 1,
          oid: "citsRsuV2xMsgTxTable",
          tableList: [
            { oid: "citsRsuV2xMsgTxChannel", value: 173, value_type: 3 },
            { oid: "citsRsuV2xMsgTxDataRate", value: 12, value_type: 3 },
            { oid: "citsRsuV2xMsgTxHdrChannel", value: 1, value_type: 1 },
            { oid: "citsRsuV2xMsgTxHdrDataRate", value: 0, value_type: 1 },
            { oid: "citsRsuV2xMsgTxHdrTxPower", value: 1, value_type: 1 },
            { oid: "citsRsuV2xMsgTxId", value: 100, value_type: 3 },
            { oid: "citsRsuV2xMsgTxIndex", value: 1, value_type: 1 },
            { oid: "citsRsuV2xMsgTxInterval", value: 100, value_type: 3 },
            { oid: "citsRsuV2xMsgTxPayload", value: mapDataContent, value_type: 5 },
            { oid: "citsRsuV2xMsgTxPayloadSecType", value: 1, value_type: 1 },
            { oid: "citsRsuV2xMsgTxPayloadType", value: 0, value_type: 1 },
            { oid: "citsRsuV2xMsgTxPeer", value: "FF:FF:FF:FF:FF:FF", value_type: 5 },
            { oid: "citsRsuV2xMsgTxPower", value: 23, value_type: 3 },
            { oid: "citsRsuV2xMsgTxPriority", value: 1, value_type: 3 },
            { oid: "citsRsuV2xMsgTxPsid", value: 82056, value_type: 3 },
            { oid: "citsRsuV2xMsgTxStartTime", value: 0, value_type: 3 },
            { oid: "citsRsuV2xMsgTxStopTime", value: 939128857, value_type: 3 },
            { oid: "citsRsuV2xMsgTxType", value: 1, value_type: 1 },
          ],
        },
      };

      const response = await rpcDirect({
        pktOrIp: deviceIp,
        reqTopic,
        resTopic,
        payload,
        match: (e) => {
          return e?.header?.transactionId === transactionId;
        },
        timeoutMs: 10000,
        qos: 1,
      });

      if (response?.header?.CODE === "200") {
        console.log("MAP data update success:", response);
        alert("MAP 데이터 업데이트 완료");
      } else {
        console.warn("Unexpected response code:", response?.header?.CODE);
        alert(`응답 코드: ${response?.header?.CODE}`);
      }
    } catch (error) {
      console.error("MAP data update failed:", error);
      alert(`전송 실패: ${error?.message || error}`);
    }
  }

  async function handleRebootBtn() {
    if (!hasDeviceIp) {
      alert("장치의 IP 주소를 찾을 수 없습니다.");
      return;
    }

    const reqTopic = MQTT_TOPICS.REBOOT_REQ;
    const resTopic = MQTT_TOPICS.REBOOT_RES;

    if (!window.confirm("정말로 재부팅 하시겠습니까?"))
      return;

    try {
      await rpcDirect({
        pktOrIp: deviceIp,
        reqTopic,
        resTopic,
        payload: {
          VER: "1.0",
          TRANSACTION_ID: generateTransactionId(),
          MSG: "Maintenance reboot",
        },
        match: (e) => {
          return e?.CODE == 200 || e?.code == 200;
        },
        timeoutMs: 10000,
        qos: 1,
      });

      alert("재부팅 요청 전송 완료");
    } catch (error) {
      console.error("Reboot failed:", error);
      alert(`전송 실패: ${error?.message || error}`);
    }
  }

  /**
   * S/W 업데이트 버튼 핸들러
   */
  async function handleSwUpdateBtn() {
    if (!hasDeviceIp) {
      alert("장치의 IP 주소를 찾을 수 없습니다.");
      return;
    }

    if (!hasOtaPackages) {
      alert("OTA 업데이트 경로가 설정되지 않았습니다.\nSettings에서 경로를 설정하세요.");
      return;
    }

    try {
      await performUpdate(selected.id, deviceIp);
      checkedDevicesRef.current.delete(selected.id);
    } catch (error) {
      console.error("SW Update failed:", error);
      alert(`업데이트 실패: ${error?.message || error}`);
    }
  }

  /**
   * 수동 버전 체크
   */
  async function handleManualVersionCheck() {
    if (!hasDeviceIp) {
      alert("장치의 IP 주소를 찾을 수 없습니다.");
      return;
    }

    if (!hasOtaPackages) {
      alert("OTA 업데이트 경로가 설정되지 않았습니다.\nSettings에서 경로를 설정하세요.");
      return;
    }

    try {
      console.log(`[OTA] Manual version check for device: ${selected.id}`);
      
      checkedDevicesRef.current.delete(selected.id);
      
      await checkDeviceVersion(selected.id, deviceIp);
      
      checkedDevicesRef.current.add(selected.id);
    } catch (error) {
      console.error("Manual version check failed:", error);
      alert(`버전 체크 실패: ${error?.message || error}`);
    }
  }

  // S/W 업데이트 버튼 상태 결정
  const getSwUpdateButtonState = () => {
    // ⭐ IP가 없으면 비활성화
    if (!hasDeviceIp) {
      return {
        disabled: true,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-slate-700 opacity-50 cursor-not-allowed",
        text: "S/W 업데이트",
        title: "장치 IP를 찾을 수 없습니다",
      };
    }

    // ⭐ OTA 경로가 유효하지 않으면 비활성화
    if (!hasOtaPackages) {
      return {
        disabled: true,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-slate-700 opacity-50 cursor-not-allowed",
        text: "S/W 업데이트",
        title: "Settings에서 OTA 패키지를 업로드하세요",
        onClick: handleManualVersionCheck,
      };
    }

    if (!deviceStatus) {
      return {
        disabled: false,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-cyan-900/90",
        text: "S/W 업데이트",
        onClick: handleManualVersionCheck,
      };
    }

    if (deviceStatus.checking) {
      return {
        disabled: true,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-slate-700 opacity-75 cursor-wait",
        text: "버전 확인 중...",
      };
    }

    if (deviceStatus.error) {
      return {
        disabled: false,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-red-900/50",
        text: "재시도",
        title: deviceStatus.error,
        onClick: handleManualVersionCheck,
      };
    }

    if (isUpdating) {
      return {
        disabled: true,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-blue-900 opacity-75 cursor-wait",
        text: "업데이트 중...",
      };
    }

    if (deviceStatus.hasUpdate) {
      return {
        disabled: false,
        className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-amber-600 hover:bg-amber-700 transition-colors",
        text: `업데이트 (${deviceStatus.updateCount})`,
        onClick: handleSwUpdateBtn,
      };
    }

    return {
      disabled: false,
      className: "w-40 flex-auto device-inspection-icon-btn justify-center bg-emerald-900/50",
      text: "최신 버전",
      onClick: handleManualVersionCheck,
    };
  };

  const swUpdateButtonState = getSwUpdateButtonState();

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
        <div 
          type="button" 
          onClick={hasDeviceIp ? handleRebootBtn : null}
          className={`col-span-2 device-inspection-icon-btn ${
            hasDeviceIp ? "bg-rose-900/90" : "bg-slate-700 opacity-50 cursor-not-allowed"
          }`}
          title={!hasDeviceIp ? "장치 IP를 찾을 수 없습니다" : ""}
        >
          <span>재부팅</span>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex justify-between col-span-12 space-x-2">
          {/* MAP Data 업데이트 - IP 체크 */}
          <button 
            onClick={hasDeviceIp ? handleMapDataUpdateBtn : null}
            disabled={!hasDeviceIp}
            className={`w-40 flex-auto device-inspection-icon-btn justify-center ${
              hasDeviceIp ? "bg-cyan-900/90" : "bg-slate-700 opacity-50 cursor-not-allowed"
            }`}
            title={!hasDeviceIp ? "장치 IP를 찾을 수 없습니다" : ""}
          >
            <span>MAP Data 업데이트</span>
          </button>

          {/* 장치제어(SNMP) - IP 체크 */}
          <button 
            disabled={!hasDeviceIp}
            className={`w-40 flex-auto device-inspection-icon-btn justify-center ${
              hasDeviceIp ? "bg-cyan-900/90" : "bg-slate-700 opacity-50 cursor-not-allowed"
            }`}
            title={!hasDeviceIp ? "장치 IP를 찾을 수 없습니다" : ""}
          >
            <span>장치제어(SNMP)</span>
          </button>
          
          {/* S/W 업데이트 - IP & OTA 경로 체크 */}
          <button
            onClick={swUpdateButtonState.onClick}
            disabled={swUpdateButtonState.disabled}
            className={swUpdateButtonState.className}
            title={swUpdateButtonState.title}
          >
            <span>{swUpdateButtonState.text}</span>
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

      {/* 모달들 */}
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
  const SecurityIcon = isTamperOn ? ShieldCheck : ShieldOff;
  const certState = determineCertState(certificate, certDaysLeft);
  const certConfig = getCertConfig(certState, certDaysLeft);

  return (
    <>
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

function extractHealthIssues(health) {
  if (!health) return [];
  if (Array.isArray(health.issues) && health.issues.length > 0) {
    return health.issues;
  }
  const flags = health.flags && typeof health.flags === "object" ? health.flags : null;
  if (!flags) return [];
  return Object.entries(flags)
    .filter(([_, value]) => value === false)
    .map(([key]) => HEALTH_CHECK_LABELS[key] || key);
}

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