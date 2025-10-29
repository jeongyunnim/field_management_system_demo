// src/services/mqtt/bus.js

/**
 * MQTT 메시지 버스
 * 
 * 역할:
 * - MQTT 메시지 라우팅 및 관리
 * - Promise 기반 요청/응답 패턴
 * - 자동 초기화 및 재연결
 * 
 * 구조:
 * - 검사 제어 → inspectionController
 * - 보고서 생성 → reportController
 * - RSE 상태 → rseHandler
 * - VM 상태 → vmHandler
 */

import { useMqttStore } from "../../stores/MqttStore";
import { logEvent } from "../../core/logger";
import { startSystemCheck } from "./inspectionController";
import { handleVmStatus } from "./vmHandler";
import { handleRseStatus } from "./rseHandler";

// ========================================
// MQTT 토픽 정의
// ========================================

export const FMS_TOPICS = {
  startReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshotQuery/req",
  startResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/systemSnapshotQuery/resp",
  vmStatus: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/vmStatus/jsonMsg",
  rseStatus: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshot/jsonMsg",
  deviceConfigQueryReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/deviceConfigQuery/req",
  deviceConfigQueryResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/deviceConfigQuery/resp",
  deviceConfigInfo: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/deviceConfig/jsonMsg",
  deviceUpdateReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SYS_CTRL_PA/deviceConfigUpdate/req",
  deviceUpdateRes: "fac/SYS_CTRL_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/deviceConfigUpdate/resp"
};

// ========================================
// Promise 기반 요청/응답 관리
// ========================================

const waiters = new Map();

/**
 * Promise 대기 (타임아웃 지원)
 * 
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
 * 
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
 * 
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
let isInitializing = false;

/**
 * MQTT 버스 초기화
 * 
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

  // 기본 토픽 구독 (startResp, vmStatus)
  // 주의: rseStatus는 검사 시작 시 구독됨
  const baseTopics = [
    FMS_TOPICS.startResp,
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

  // 대기 중인 Promise 모두 정리
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
// 자동 초기화
// ========================================

/**
 * MQTT 연결 및 버스 초기화 보장
 * 
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} retryDelay - 재시도 간격 (밀리초)
 * @returns {Promise<void>}
 */
export async function ensureInitialized(maxRetries = 3, retryDelay = 500) {
  // 이미 초기화되어 있으면 즉시 반환
  if (initialized) {
    return;
  }

  // 초기화 중이면 대기
  if (isInitializing) {
    logEvent({
      level: "INFO",
      source: "BUS",
      event: "WAIT_INIT",
      message: "Waiting for initialization to complete",
    });

    // 초기화 완료까지 대기 (최대 5초)
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      if (initialized) {
        return;
      }
    }
    throw new Error("Initialization timeout");
  }

  isInitializing = true;

  try {
    const mqtt = useMqttStore.getState();

    // 1. MQTT 연결 확인 및 재연결
    if (!mqtt.connected) {
      logEvent({
        level: "WARN",
        source: "BUS",
        event: "MQTT_NOT_CONNECTED",
        message: "MQTT not connected, attempting to connect",
      });

      // MQTT 연결 시도
      mqtt.connect();

      // 연결 대기 (최대 재시도)
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await sleep(retryDelay);
        
        if (mqtt.connected) {
          logEvent({
            level: "INFO",
            source: "BUS",
            event: "MQTT_CONNECTED",
            message: `MQTT connected after ${attempt + 1} attempts`,
          });
          break;
        }

        if (attempt === maxRetries - 1) {
          throw new Error("MQTT connection timeout");
        }
      }
    }

    // 2. 버스 초기화
    if (!initialized) {
      logEvent({
        level: "INFO",
        source: "BUS",
        event: "AUTO_INIT",
        message: "Auto-initializing MQTT bus",
      });

      initMqttBus();
    }

  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "BUS",
      event: "INIT_FAIL",
      message: "Failed to ensure initialization",
      details: { error: error.message },
    });
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * 버스 초기화 상태 확인
 * 
 * @returns {boolean}
 */
export function isInitialized() {
  return initialized;
}

/**
 * 유틸리티: Sleep
 * 
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 검사 제어 API
// ========================================

/**
 * 검사 제어 명령 요청 (자동 초기화 지원)
 * 
 * @param {string} command - "startSystemCheck" | "stopSystemCheck"
 * @param {Object} payload - 요청 페이로드
 * @param {Object} options - 옵션 { timeoutMs, qos, retain, autoInit }
 * @returns {Promise<Object>} 응답 객체
 */
export async function request(command, payload = {}, options = {}) {
  const { autoInit = true, ...otherOptions } = options;

  // 자동 초기화 (기본값: true)
  if (autoInit && !initialized) {
    logEvent({
      level: "INFO",
      source: "BUS",
      event: "AUTO_INIT_TRIGGERED",
      message: "Triggering auto-initialization",
    });

    try {
      await ensureInitialized();
    } catch (error) {
      logEvent({
        level: "ERROR",
        source: "BUS",
        event: "AUTO_INIT_FAILED",
        message: "Auto-initialization failed",
        details: { error: error.message },
      });
      throw new Error(`Failed to initialize: ${error.message}`);
    }
  }

  // 여전히 초기화되지 않았으면 에러
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
    return startSystemCheck(waitFor, payload, otherOptions);
  }

  logEvent({
    level: "ERROR",
    source: "BUS",
    event: "UNKNOWN_COMMAND",
    message: `Unknown command: ${command}`,
  });
  
  throw new Error(`Unknown command: ${command}`);
}