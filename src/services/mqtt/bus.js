// src/services/mqtt/bus.js
// 요청/응답 매칭, 타임아웃, 점검 세션 라우팅, 패킷 처리
import { isDeviceRegistered } from "../../dbms/deviceDb";
import { useMetricsStore } from "../../stores/MetricsStore";
import { useMqttStore } from "../../stores/MqttStore";
import { useVmStatusStore } from "../../stores/VmStatusStore";
import { rseToItem } from "../../utils/rseTransform";
import { useRseStore } from "../../stores/RseStore";


const TOPICS = {
  startReq:  "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/startSystemCheck/req",
  startResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
  stopReq:   "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/stopSystemCheck/req",
  stopResp:  "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/resp",
  vmStatus:  "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/vmStatus/jsonMsg",
  rseStatus: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshot/jsonMsg",
};

// 내부 상태
let initialized = false;
let offHandler = null;
let isInspecting = false;
let rseSubscribed = false;
let respSubscribed = false;

// 요청 대기(한 번만)
let pendingStart = null; // { resolve, reject, timer }
let pendingStop  = null;


// ---------- 라우팅 테이블 ----------
const ROUTES = [
  {
    // startSystemCheck 응답
    match: (t) => t === TOPICS.startResp && !!pendingStart,
    handle: (_t, payload) => {
      const { resolve, timer } = pendingStart;
      clearTimeout(timer);
      pendingStart = null;
      resolve(safeJsonOrText(payload));
    },
  },
  {
    // stopSystemCheck 응답
    match: (t) => t === TOPICS.stopResp && !!pendingStop,
    handle: (_t, payload) => {
      const { resolve, timer } = pendingStop;
      clearTimeout(timer);
      pendingStop = null;
      resolve(safeJsonOrText(payload));
    },
  },
  {
    // 점검 중 상태 메시지 (세션 중에만 처리)
    match: (t) => t === TOPICS.vmStatus,
    handle: (_t, payload) => handleVmStatus(payload),
  },
  {
    // RSE 스냅샷
    match: (t) => t === TOPICS.rseStatus && isInspecting,
    handle: (_t, payload) => handleRseStatus(payload),
  },
  // 필요한 라우트는 아래에 계속 추가…
];

// ---------- 초기화/정리 ----------
export function initMqttBus() {
  if (initialized) return disposeMqttBus;
  const store = useMqttStore.getState();

  // 전역 응답 토픽 전부 구독
  if (!respSubscribed) {
    store.subscribeTopics([TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus], { qos: 1 });
    respSubscribed = true;
  }

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

  // pending 정리
  if (pendingStart) { 
    clearTimeout(pendingStart.timer); 
    pendingStart.reject?.(new Error("startSystemCheck: disposed")); 
    pendingStart = null; 
  }
  if (pendingStop)  { 
    clearTimeout(pendingStop.timer);  
    pendingStop.reject?.(new Error("stopSystemCheck: disposed"));  
    pendingStop  = null; 
  }

  // 전역 구독 해제
  if (respSubscribed) {
    try { 
      useMqttStore.getState().unsubscribeTopics([TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus]); 
    } catch {}
    respSubscribed = false;
  }
  if (rseSubscribed) {
    try { 
      useMqttStore.getState().unsubscribeTopics([TOPICS.rseStatus]); 
    } catch {}
    rseSubscribed = false;
  }
  isInspecting = false;
  initialized = false;
}

// ---------- 요청/응답 ----------
export function request(command, payload = {}, { timeoutMs = 10000, qos = 1, retain = false } = {}) {
  if (command === "startSystemCheck") {
    return requestOnce(TOPICS.startReq, "start", payload, { timeoutMs, qos, retain });
  }
  if (command === "stopSystemCheck") {
    return requestOnce(TOPICS.stopReq, "stop", payload, { timeoutMs, qos, retain });
  }
  return Promise.reject(new Error(`Unknown command: ${command}`));
}

function requestOnce(reqTopic, kind, payload, { timeoutMs, qos, retain }) {
  const store = useMqttStore.getState();

  if (kind === "start" && pendingStart) 
    return Promise.reject(new Error("startSystemCheck: already pending"));
  if (kind === "stop"  && pendingStop )  
    return Promise.reject(new Error("stopSystemCheck: already pending"));

  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (kind === "start") 
        pendingStart = null;
      if (kind === "stop")  
        pendingStop  = null;
      reject(new Error(`${kind}SystemCheck: response timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    const slot = { resolve, reject, timer };
    if (kind === "start") pendingStart = slot;
    if (kind === "stop")  pendingStop  = slot;
  });

  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  store.publish(reqTopic, body, { qos, retain });

  return promise;
}

// ===== 점검 세션 =====
export function startInspection() {
  isInspecting = true;
  if (!rseSubscribed) {
    useMqttStore.getState().subscribeTopics([TOPICS.rseStatus], { qos: 1 });
    rseSubscribed = true;
  }
}
export function stopInspection() {
  isInspecting = false;
  if (rseSubscribed) {
    useMqttStore.getState().unsubscribeTopics([TOPICS.rseStatus]);
    rseSubscribed = false;
  }
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
  const msg = safeJsonOrText(buf);      // 기존 로직 유지 (문자열 or JS 객체 반환 가정)
  const data = typeof msg === "string" ? JSON.parse(msg) : msg;

  const serial = data?.serial_number;

  if (!(await isDeviceRegistered(serial))) 
  {
    console.debug("[rseStatus] ignored (unregistered):", serial);
    return ;
  }

  const item = rseToItem(data); // { id: serial, ... }

  try {
    useRseStore.getState().upsertRseStatus(item.id, serial, data);
  } catch (e) {
    console.warn("RseStore ingest failed:", e);
  }
  if (typeof window !== "undefined" && typeof window.__pushRseItem === "function") {
    window.__pushRseItem(item);  // MonitoringDeviceList로 업서트
  }

  useMetricsStore.getState().pushFromItem(item);
  console.log("[rseStatus] upsert (registered):", item.id);

}


// ---------- 유틸 ----------
function safeJsonOrText(buf) {
  const text = safeDecode(buf);
  try { return JSON.parse(text); } catch { return text; }
}
function safeDecode(buf) {
  try { return new TextDecoder().decode(buf); } catch { return ""; }
}