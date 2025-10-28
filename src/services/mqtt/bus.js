// src/services/mqtt/bus.js

/**
 * 역할: MQTT 메시지 라우팅
 * 
 * 주요 기능:
 * - MQTT 버스 초기화/해제
 * - 메시지 라우팅
 * - Promise 기반 요청/응답 관리
 * 
 * 구조 개선:
 * - 검사 제어 → inspectionController
 * - 보고서 생성 → reportController
 * - RSE 상태 → rseHandler
 * - VM 상태 → vmHandler
 */

import { useMqttStore } from "../../stores/MqttStore";
import { logEvent } from "../../core/logger";
import { startSystemCheck, stopSystemCheck } from "./inspectionController";
import { handleVmStatus } from "./vmHandler";
import { handleRseStatus } from "./rseHandler";

// ========================================
// MQTT 토픽 정의
// ========================================

export const FMS_TOPICS = {
  startReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/startSystemCheck/req",
  startResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
  stopReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/stopSystemCheck/req",
  stopResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/resp",
  vmStatus: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/vmStatus/jsonMsg",
  rseStatus: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshot/jsonMsg",
};

// ========================================
// Promise 기반 요청/응답 관리
// ========================================

const waiters = new Map();

/**
 * Promise 대기 (타임아웃 지원)
 * @param {string} topic - 응답 토픽
 * @param {number} timeoutMs - 타임아웃 (밀리초)
 * @returns {Promise<any>} 응답 데이터
 */
function waitFor(topic, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(topic);
      
      logEvent({
        level: "ERROR",
        source: "BUS",
        event: "REQ_TIMEOUT",
        message: `Request timeout: ${topic}`,
        details: { timeoutMs },
      });
      
      reject(new Error(`Timeout waiting for: ${topic}`));
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

/**
 * 대기 중인 Promise 해결
 * @param {string} topic - 토픽
 * @param {any} payload - 응답 데이터
 */
function resolveWait(topic, payload) {
  const waiter = waiters.get(topic);
  if (waiter) {
    waiter.resolve(payload);
  }
}

// ========================================
// 메시지 라우팅
// ========================================

const ROUTES = [
  {
    match: (topic) => topic === FMS_TOPICS.startResp,
    handle: (_topic, payload) => resolveWait(FMS_TOPICS.startResp, payload),
  },
  {
    match: (topic) => topic === FMS_TOPICS.stopResp,
    handle: (_topic, payload) => resolveWait(FMS_TOPICS.stopResp, payload),
  },
  {
    match: (topic) => topic === FMS_TOPICS.vmStatus,
    handle: (_topic, payload) => handleVmStatus(payload),
  },
  {
    match: (topic) => topic === FMS_TOPICS.rseStatus,
    handle: (_topic, payload) => handleRseStatus(payload),
  },
];

/**
 * 메시지 라우팅 핸들러
 * @param {string} topic - MQTT 토픽
 * @param {Buffer} payload - 메시지 페이로드
 */
function routeMessage(topic, payload) {
  for (const route of ROUTES) {
    if (route.match(topic)) {
      route.handle(topic, payload);
      return;
    }
  }
  
  // 처리되지 않은 메시지
  logEvent({
    level: "WARN",
    source: "BUS",
    event: "UNHANDLED_MESSAGE",
    message: `No handler for topic: ${topic}`,
  });
}

// ========================================
// MQTT 버스 초기화/해제
// ========================================

let initialized = false;
let offHandler = null;

/**
 * MQTT 버스 초기화
 * @returns {Function} dispose 함수
 */
export function initMqttBus() {
  if (initialized) {
    logEvent({
      level: "WARN",
      source: "BUS",
      event: "ALREADY_INIT",
      message: "MQTT bus already initialized",
    });
    return disposeMqttBus;
  }

  const mqtt = useMqttStore.getState();

  // 기본 토픽 구독 (startResp, stopResp, vmStatus)
  const baseTopics = [
    FMS_TOPICS.startResp,
    FMS_TOPICS.stopResp,
    FMS_TOPICS.vmStatus,
  ];

  mqtt.subscribeTopics(baseTopics, { qos: 1 });

  logEvent({
    level: "INFO",
    source: "BUS",
    event: "SUBSCRIBE",
    message: "MQTT bus subscribed to base topics",
    details: { topics: baseTopics },
  });

  // 메시지 핸들러 등록
  offHandler = mqtt.addMessageHandler(routeMessage);

  initialized = true;

  logEvent({
    level: "INFO",
    source: "BUS",
    event: "INITIALIZED",
    message: "MQTT bus initialized successfully",
  });

  return disposeMqttBus;
}

/**
 * MQTT 버스 해제
 */
export function disposeMqttBus() {
  if (!initialized) {
    return;
  }

  // 메시지 핸들러 해제
  if (offHandler) {
    offHandler();
    offHandler = null;
  }

  // 토픽 구독 해제
  try {
    const mqtt = useMqttStore.getState();
    const allTopics = Object.values(FMS_TOPICS);
    
    mqtt.unsubscribeTopics(allTopics);

    logEvent({
      level: "INFO",
      source: "BUS",
      event: "UNSUBSCRIBE",
      message: "All topics unsubscribed",
    });
  } catch (error) {
    logEvent({
      level: "WARN",
      source: "BUS",
      event: "UNSUBSCRIBE_FAIL",
      message: "Failed to unsubscribe topics",
      details: { error: error.message },
    });
  }

  // 대기 중인 Promise 모두 reject
  for (const [topic, waiter] of waiters) {
    waiter.resolve(null);
  }
  waiters.clear();

  initialized = false;

  logEvent({
    level: "INFO",
    source: "BUS",
    event: "DISPOSED",
    message: "MQTT bus disposed successfully",
  });
}

// ========================================
// 검사 제어 API
// ========================================

/**
 * 검사 제어 명령 요청
 * @param {string} command - "startSystemCheck" | "stopSystemCheck"
 * @param {Object} payload - 요청 페이로드
 * @param {Object} options - 옵션 { timeoutMs, qos, retain }
 * @returns {Promise<Object>} 응답 객체
 */
export async function request(command, payload = {}, options = {}) {
  if (!initialized) {
    logEvent({
      level: "ERROR",
      source: "BUS",
      event: "NOT_INITIALIZED",
      message: "Cannot send request: MQTT bus not initialized",
    });
    throw new Error("MQTT bus not initialized");
  }

  if (command === "startSystemCheck") {
    return startSystemCheck(waitFor, payload, options);
  }

  if (command === "stopSystemCheck") {
    return stopSystemCheck(waitFor, payload, options);
  }

  logEvent({
    level: "ERROR",
    source: "BUS",
    event: "UNKNOWN_COMMAND",
    message: `Unknown command: ${command}`,
  });
  
  throw new Error(`Unknown command: ${command}`);
}

// ========================================
// 레거시 호환 (선택)
// ========================================

// RSE 최신 데이터 저장소 (기존 코드 호환용)
if (typeof window !== "undefined") {
  window.__latestRseById = window.__latestRseById || {};
  window.__getRseLatestArray = () => Object.values(window.__latestRseById || {});
}
