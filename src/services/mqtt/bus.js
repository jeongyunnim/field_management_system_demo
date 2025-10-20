// src/services/mqtt/bus.js
// 요청/응답 매칭, 타임아웃, 점검 세션 라우팅, 패킷 처리
import { isDeviceRegistered, getDeviceIdBySerial } from "../../dbms/deviceDb";
import { useMetricsStore } from "../../stores/MetricsStore";
import { useMqttStore } from "../../stores/MqttStore";
import { useVmStatusStore } from "../../stores/VmStatusStore";
import { rseToItem } from "../../utils/transformRse";
import { useRseStore } from "../../stores/RseStore";
import { useInspectStore } from "../../stores/InspectStore";
import { openRseReportPrint } from "../../utils/resReport";
import { memoryRecorder } from "../../core/MemoryRecorder";
import { downloadCsvInBrowser, saveCsvOnAndroid } from "../../core/exporters";
import { CSV_HEADER } from "../../adapters/packetToCsvRow";
import { Capacitor } from "@capacitor/core";

const TOPICS = {
  startReq:  "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/startSystemCheck/req",
  startResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
  stopReq:   "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/stopSystemCheck/req",
  stopResp:  "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/resp",
  vmStatus:  "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/vmStatus/jsonMsg",
  rseStatus: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshot/jsonMsg",
};

let initialized = false;
let offHandler = null;

// 토픽별 1회 응답 대기 레지스트리
const waiters = new Map(); // topic -> { resolve }

if (typeof window !== "undefined") {
  window.__latestRseById = window.__latestRseById || {};
  window.__getRseLatestArray = () => Object.values(window.__latestRseById || {});
}

function waitFor(topic, timeoutMs) {
  return new Promise((resolve, reject) => {
    // 타임아웃 설정
    const timer = setTimeout(() => {
      waiters.delete(topic);
      reject(new Error(`Timeout waiting: ${topic}`));
    }, timeoutMs);
    // 등록 (resolve되면 타이머 정리)
    waiters.set(topic, {
      resolve: (payload) => {
        clearTimeout(timer);
        waiters.delete(topic);
        resolve(payload);
      },
    });
  });
}

function resolveWait(topic, payload) {
  const w = waiters.get(topic);
  if (w) w.resolve(payload);
}
// ---------- 라우팅 테이블 ----------
const ROUTES = [
  {
    // startSystemCheck 응답
    match: (t) => t === TOPICS.startResp,
    handle: (_t, payload) => resolveWait(TOPICS.startResp, payload),
  },
  {
    // stopSystemCheck 응답
    match: (t) => t === TOPICS.stopResp,
    handle: (_t, payload) => resolveWait(TOPICS.stopResp, payload),
  },
  {
    // 점검 중 상태 메시지 (세션 중에만 처리)
    match: (t) => t === TOPICS.vmStatus,
    handle: (_t, payload) => handleVmStatus(payload),
  },
  {
    // RSE 스냅샷
    match: (t) => t === TOPICS.rseStatus,
    handle: (_t, payload) => handleRseStatus(payload),
  },
  // 필요한 라우트는 아래에 계속 추가…
];

// ---------- 초기화/정리 ----------
export function initMqttBus() {
  if (initialized) return disposeMqttBus;
  const store = useMqttStore.getState();

  store.subscribeTopics([TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus], { qos: 1 });

  // 공용 메시지 핸들러(= 라우터)
  offHandler = store.addMessageHandler((topic, payload /*, packet */) => {
    for (const r of ROUTES) {
      if (r.match(topic)) {
        r.handle(topic, payload);
        return; // 첫 매칭 처리 후 종료
      }
    }
    // 매칭 안되면 무시
  });

  initialized = true;
  return disposeMqttBus;
}

export function disposeMqttBus() {
  if (!initialized) return;
  offHandler?.(); offHandler = null;

  try {
    useMqttStore.getState().unsubscribeTopics([
      TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus, TOPICS.rseStatus,
    ]);
  } catch {}
  initialized = false;
}

// ---------- 요청/응답 ----------
export function request(command, payload = {}, { timeoutMs = 10000, qos = 1, retain = false } = {}) {
  const mqtt = useMqttStore.getState();
  const inspect = useInspectStore.getState();

  if (command === "startSystemCheck") {
    if (inspect.phase !== "idle") return Promise.resolve(null); // 버튼 비활성 상태에서 보호
    inspect.setPhase("requesting");
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    mqtt.publish(TOPICS.startReq, body, { qos, retain }); // pub 딱 1회
    return waitFor(TOPICS.startResp, timeoutMs)
      .then((resp) => {
        inspect.setPhase("running");
        startInspection();
        inspect.setStartedAt(Date.now);
        return safeJsonOrText(resp);
      })
      .catch((e) => {
        inspect.setPhase("idle"); // 실패/타임아웃 시 버튼 복구
        throw e;
      });
  }

  if (command === "stopSystemCheck") {
  if (inspect.phase !== "running") return Promise.resolve(null);
  inspect.setPhase("stopping");
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  mqtt.publish(TOPICS.stopReq, body, { qos, retain });
  const startedAt = inspect.startedAt ?? null;

  return waitFor(TOPICS.stopResp, timeoutMs)
    .then(async (resp) => {
      inspect.setPhase("idle");
      stopInspection();

      // 사용자에게 출력 확인
      const wantPrint = window.confirm("보고서를 출력하시겠습니까?");
      if (wantPrint) {
        // stop recorder and export CSV
        try {
          memoryRecorder.stop();
        } catch (e) {
          console.warn("recorder stop failed:", e);
        }

        const header = memoryRecorder.header();
        const rows = memoryRecorder.getRows();
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `rse_report_${ts}.csv`;

        // 플랫폼 확인(안드로이드일 때 native 저장 시도, 실패 시 브라우저로 폴백)
        let savedNatively = false;
        try {
          const platform = (typeof Capacitor?.getPlatform === "function") ? Capacitor.getPlatform() : null;
          const isAndroid = platform === "android";
          if (isAndroid) {
            // saveCsvOnAndroid 내부에서 dynamic import 처리를 하므로 빌드 오류 없음
            savedNatively = await saveCsvOnAndroid(filename, header, rows);
          }
        } catch (e) {
          console.warn("native save attempt failed:", e);
          savedNatively = false;
        }

        // native 저장을 못했거나 네이티브 환경이 아니면 브라우저 다운로드로 폴백
        if (!savedNatively) {
          try {
            downloadCsvInBrowser(filename, header, rows);
          } catch (e) {
            console.error("downloadCsvInBrowser failed:", e);
            // (옵션) 사용자에게 실패 안내
            alert("보고서 저장에 실패했습니다. 콘솔을 확인하세요.");
          }
        } else {
          // (옵션) 성공 알림: 네이티브 저장 성공
          // alert("보고서가 기기에 저장되었습니다.");
        }
      }

      return safeJsonOrText(resp);
    })
    .catch((e) => {
      inspect.setPhase("running"); // 실패/타임아웃 시 다시 중단 시도 가능
      throw e;
    });
  }
}

export function startInspection() {
  useMqttStore.getState().subscribeTopics([TOPICS.rseStatus], { qos: 1 });
  // 메모리 수집 시작
  try { memoryRecorder.start(); } catch (e) { console.warn("recorder start failed:", e); }
}

export function stopInspection() {
  useMqttStore.getState().unsubscribeTopics([TOPICS.rseStatus]);
  // recorder는 stopSystemCheck 성공 시 stop() 호출(혹은 여기서 호출해도 무방)
  // memoryRecorder.stop(); // (일괄 stop은 stopSystemCheck 성공 블록에서 실행)
}


// ---------- vmStatus 처리 ----------
function handleVmStatus(buf) {
  const msg = safeJsonOrText(buf);
  try {
    useVmStatusStore.getState().setFromVmStatus(msg);
  } catch (e) {
    console.warn("vmStatus parse failed:", e);
  }
}

// ---------- rseStatus 처리 ----------
export async function handleRseStatus(buf) {
  const msg = safeJsonOrText(buf);
  const data = typeof msg === "string" ? safeJsonOrText(msg) : msg;

  const serial = data?.serial_number;

  if (!(await isDeviceRegistered(serial))) 
  {
    console.debug("[rseStatus] ignored (unregistered):", serial);
    return ;
  }

  const canonicalId = await getDeviceIdBySerial(serial);
  if (!canonicalId) {
    console.warn("[rseStatus] no canonical id for serial:", serial);
    return;
  }

  const item = rseToItem(data, canonicalId); // { id: serial, ... }

  try {
    useRseStore.getState().upsertRseStatus(item.id, serial, data);
  } catch (e) {
    console.warn("RseStore upsert failed:", e);
  }

  // --- 기록용: 메모리 레코더에 원본 패킷 저장 (시리얼이 유효한 경우) ---
  try {
    memoryRecorder.add(data, Date.now());
  } catch (e) {
    console.warn("memoryRecorder.add failed:", e);
  }

  if (typeof window !== "undefined") {
    window.__latestRseById[item.id] = {
      ...item,
      __receivedAt: Date.now(),    // 앱이 받은 시각
      __rawTs: data?.timestamp ?? data?.ts ?? null,  // 장치 원본 TS(있으면)
    };
    if (typeof window.__pushRseItem === "function") {
      window.__pushRseItem(item);  // MonitoringDeviceList로 업서트
    }
  }
  useMetricsStore.getState().pushFromItem(item);
  console.debug("[rseStatus] upsert (registered):", item.id);
}


// ---------- 유틸 ----------
function safeJsonOrText(buf) {
  const text = safeDecode(buf);
  try { return JSON.parse(text); } catch { return text; }
}
function safeDecode(buf) {
  try { return new TextDecoder().decode(buf); } catch { return ""; }
}