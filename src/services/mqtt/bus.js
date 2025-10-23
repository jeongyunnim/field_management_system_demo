// src/services/mqtt/bus.js
import { isDeviceRegistered, getDeviceIdBySerial } from "../../dbms/deviceDb";
import { useMetricsStore } from "../../stores/MetricsStore";
import { useMqttStore } from "../../stores/MqttStore";
import { useVmStatusStore } from "../../stores/VmStatusStore";
import { rseToItem } from "../../utils/transformRse";
import { useRseStore } from "../../stores/RseStore";
import { useInspectStore } from "../../stores/InspectStore";
import { memoryRecorder } from "../../core/MemoryRecorder";
import { downloadCsvInBrowser, saveCsvOnAndroid } from "../../core/exporters";
import { logEvent } from "../../core/logger";
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
const waiters = new Map();

if (typeof window !== "undefined") {
  window.__latestRseById = window.__latestRseById || {};
  window.__getRseLatestArray = () => Object.values(window.__latestRseById || {});
}

// ========================================
// Promise/Wait 유틸리티
// ========================================

function waitFor(topic, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(topic);
      logEvent({
        level: "ERROR",
        source: "BUS",
        event: "REQ_TIMEOUT",
        message: `Timeout waiting: ${topic}`,
      });
      reject(new Error(`Timeout waiting: ${topic}`));
    }, timeoutMs);
    
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

// ========================================
// 메시지 라우팅
// ========================================

const ROUTES = [
  {
    match: (t) => t === TOPICS.startResp,
    handle: (_t, payload) => resolveWait(TOPICS.startResp, payload),
  },
  {
    match: (t) => t === TOPICS.stopResp,
    handle: (_t, payload) => resolveWait(TOPICS.stopResp, payload),
  },
  {
    match: (t) => t === TOPICS.vmStatus,
    handle: (_t, payload) => handleVmStatus(payload),
  },
  {
    match: (t) => t === TOPICS.rseStatus,
    handle: (_t, payload) => handleRseStatus(payload),
  },
];

// ========================================
// MQTT 버스 초기화/해제
// ========================================

export function initMqttBus() {
  if (initialized) return disposeMqttBus;
  const store = useMqttStore.getState();

  store.subscribeTopics([TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus], { qos: 1 });
  logEvent({ 
    level: "INFO", 
    source: "MQTT", 
    event: "SUBSCRIBE", 
    message: `BUS topics subscribe [start inspect Response, stop inspect Response, vm status]`, 
  });
  
  offHandler = store.addMessageHandler((topic, payload) => {
    for (const r of ROUTES) {
      if (r.match(topic)) {
        r.handle(topic, payload);
        return;
      }
    }
  });

  initialized = true;
  return disposeMqttBus;
}

export function disposeMqttBus() {
  if (!initialized) return;
  offHandler?.(); 
  offHandler = null;
  try {
    useMqttStore.getState().unsubscribeTopics([TOPICS.startResp, TOPICS.stopResp, TOPICS.vmStatus, TOPICS.rseStatus]);
    logEvent({ level: "INFO", source: "MQTT", event: "UNSUBSCRIBE", message: "All topic unsubscribed" });
  } catch (e) {
    logEvent({ level: "WARN", source: "MQTT", event: "UNSUBSCRIBE_FAIL", message: "unsubscribe failed", details: { error: String(e) } });
  }
  initialized = false;
}

// ========================================
// 검사 제어 명령 (start/stop)
// ========================================

export function request(command, payload = {}, { timeoutMs = 10000, qos = 1, retain = false } = {}) {
  const mqtt = useMqttStore.getState();
  const inspect = useInspectStore.getState();

  if (command === "startSystemCheck") {
    return handleStartSystemCheck(mqtt, inspect, payload, { timeoutMs, qos, retain });
  }

  if (command === "stopSystemCheck") {
    return handleStopSystemCheck(mqtt, inspect, payload, { timeoutMs, qos, retain });
  }
}

function handleStartSystemCheck(mqtt, inspect, payload, { timeoutMs, qos, retain }) {
  if (inspect.phase !== "idle") return Promise.resolve(null);
  
  inspect.setPhase("requesting");
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  mqtt.publish(TOPICS.startReq, body, { qos, retain });
  logEvent({ level: "INFO", source: "BUS", entity: "FMS", event: "START_REQ", message: "startSystemCheck requested" });

  return waitFor(TOPICS.startResp, timeoutMs)
    .then((resp) => {
      logEvent({ level: "INFO", source: "BUS", entity: "FMS", event: "START_ACK", message: "startSystemCheck ack", details: { resp: safeJsonOrText(resp) } });
      inspect.setPhase("running");
      startInspection();
      inspect.setStartedAt(Date.now);
      return safeJsonOrText(resp);
    })
    .catch((e) => {
      logEvent({ level: "ERROR", source: "BUS", entity: "FMS", event: "START_FAIL", message: "startSystemCheck failed", details: { resp: String(e) } });
      inspect.setPhase("idle");
      throw e;
    });
}

function handleStopSystemCheck(mqtt, inspect, payload, { timeoutMs, qos, retain }) {
  if (inspect.phase !== "running") return Promise.resolve(null);
  
  inspect.setPhase("stopping");
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  mqtt.publish(TOPICS.stopReq, body, { qos, retain });
  
  logEvent({ level: "INFO", source: "BUS", entity: "FMS", event: "STOP_REQ", message: "stopSystemCheck requested" });
  
  return waitFor(TOPICS.stopResp, timeoutMs)
    .then(async (resp) => {
      logEvent({ level: "INFO", source: "BUS", entity: "FMS", event: "STOP_ACK", message: "stopSystemCheck ack", details: { resp: safeJsonOrText(resp) } });
      inspect.setPhase("idle");
      stopInspection();

      await handleReportGeneration();
      
      return safeJsonOrText(resp);
    })
    .catch((e) => {
      logEvent({ level: "ERROR", source: "BUS", entity: "FMS", event: "STOP_TIMEOUT", message: "stopSystemCheck timeout" });
      inspect.setPhase("running");
      throw e;
    });
}

async function handleReportGeneration() {
  const wantPrint = window.confirm("보고서를 출력하시겠습니까?");
  if (!wantPrint) return;

  try {
    memoryRecorder.stop();
  } catch (e) {
    console.warn("recorder stop failed:", e);
  }

  const header = memoryRecorder.header();
  const rows = memoryRecorder.getRows();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `rse_report_${ts}.csv`;

  let savedNatively = false;
  try {
    const platform = (typeof Capacitor?.getPlatform === "function") ? Capacitor.getPlatform() : null;
    const isAndroid = platform === "android";
    if (isAndroid) {
      savedNatively = await saveCsvOnAndroid(filename, header, rows);
    }
  } catch (e) {
    console.warn("native save attempt failed:", e);
    savedNatively = false;
  }

  if (!savedNatively) {
    try {
      downloadCsvInBrowser(filename, header, rows);
    } catch (e) {
      console.error("downloadCsvInBrowser failed:", e);
      alert("보고서 저장에 실패했습니다. 콘솔을 확인하세요.");
    }
  }
}

// ========================================
// 검사 시작/중지
// ========================================

export function startInspection() {
  useMqttStore.getState().subscribeTopics([TOPICS.rseStatus], { qos: 1 });
  try { memoryRecorder.start(); } catch (e) { console.warn("recorder start failed:", e); }
}

export function stopInspection() {
  useMqttStore.getState().unsubscribeTopics([TOPICS.rseStatus]);
}

// ========================================
// VM 상태 처리
// ========================================

function handleVmStatus(buf) {
  const msg = safeJsonOrText(buf);
  try {
    useVmStatusStore.getState().setFromVmStatus(msg);
  } catch (e) {
    logEvent({ level: "ERROR", source: "FMS", entity: "FMS", event: "VM_STATUS_PARSE_FAIL", message: "vmStatus parse failed" });
    console.warn("vmStatus parse failed:", e);
  }
}

// ========================================
// RSE 상태 처리 (등록/미등록 분기)
// ========================================

/**
 * RSE 상태 메시지 처리 (등록/미등록 분기)
 */
export async function handleRseStatus(buf) {
  const msg = safeJsonOrText(buf);
  const data = typeof msg === "string" ? JSON.parse(msg) : msg;
  
  const serial = data?.serial_number;
  if (!serial) {
    console.warn("[rseStatus] missing serial_number");
    return;
  }

  const isRegistered = await isDeviceRegistered(serial);
  
  if (!isRegistered) {
    handleUnregisteredDevice(serial, data);
    return;
  }

  await handleRegisteredDevice(data, serial);
}

/**
 * 미확인 장치 처리 (통계용으로 저장하지만 리스트에는 표시 안 함)
 */
function handleUnregisteredDevice(serial, data) {
  const unregisteredId = `unregistered_${serial}`;
  
  try {
    // 통계 목적으로만 저장 (MonitoringDeviceList에서는 필터링됨)
    useRseStore.getState().upsertUnregisteredDevice(unregisteredId, serial, data);
    
    logEvent({ 
      level: "WARN", 
      source: "RSE", 
      entity: serial, 
      event: "UNREGISTERED_DEVICE", 
      message: `Unregistered device detected: ${serial}` 
    });
    
    console.debug(`[rseStatus] Unregistered device detected (stats only): ${serial}`);
  } catch (e) {
    console.warn("Failed to track unregistered device:", e);
  }
}

/**
 * 등록된 장치 처리 (전체 파싱 및 상태 업데이트)
 */
async function handleRegisteredDevice(data, serial) {
  const canonicalId = await getDeviceIdBySerial(serial);
  
  if (!canonicalId) {
    logEvent({ 
      level: "WARN", 
      source: "RSE", 
      entity: serial, 
      event: "NO_CANONICAL_ID", 
      message: "canonical id not found" 
    });
    console.warn("[rseStatus] no canonical id for serial:", serial);
    return;
  }

  const item = rseToItem(data, canonicalId);

  updateRseStore(item, serial, data);
  recordMemory(data);
  updateMetrics(item);

  console.debug(`[rseStatus] Registered device updated: ${item.id}`);
}

function updateRseStore(item, serial, data) {
  try {
    useRseStore.getState().upsertRseStatus(item.id, serial, data);
  } catch (e) {
      logEvent({ 
      level: "INFO", 
      source: "RSE", 
      entity: item.id, 
      event: "RSE_STATUS_UPSERT", 
      message: `RseStore upsert failed: e`
    });
  }
}

function recordMemory(data) {
  try {
    memoryRecorder.add(data, Date.now());
  } catch (e) {
    console.warn("memoryRecorder.add failed:", e);
  }
}

function updateMetrics(item) {
  try {
    useMetricsStore.getState().pushFromItem(item);
  } catch (e) {
    console.warn("MetricsStore update failed:", e);
  }
}

// ========================================
// 유틸리티
// ========================================

function safeJsonOrText(buf) {
  const text = safeDecode(buf);
  try { return JSON.parse(text); } catch { return text; }
}

function safeDecode(buf) {
  try { return new TextDecoder().decode(buf); } catch { return ""; }
}