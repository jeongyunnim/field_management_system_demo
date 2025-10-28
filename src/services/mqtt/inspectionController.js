// src/services/mqtt/inspectionController.js

/**
 * 역할: 검사(Inspection) 시작/종료 제어
 * 
 * 주요 기능:
 * - startSystemCheck 명령 처리
 * - stopSystemCheck 명령 처리
 * - 검사 상태 관리
 * - RSE 상태 구독 제어
 */

import { useMqttStore } from "../../stores/MqttStore";
import { useInspectStore } from "../../stores/InspectStore";
import { memoryRecorder } from "../../core/MemoryRecorder";
import { logEvent } from "../../core/logger";
import { generateReport } from "./reportController";

const FMS_TOPICS = {
  startReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/startSystemCheck/req",
  startResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
  stopReq: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/stopSystemCheck/req",
  stopResp: "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/stopSystemCheck/resp",
  rseStatus: "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_PA/systemSnapshot/jsonMsg",
};

/**
 * 검사 시작 명령
 * @param {Function} waitFor - Promise 대기 함수
 * @param {Object} payload - 요청 페이로드
 * @param {Object} options - 옵션 { timeoutMs, qos, retain }
 * @returns {Promise<Object>} 응답 객체
 */
export async function startSystemCheck(waitFor, payload = {}, options = {}) {
  const { timeoutMs = 10000, qos = 1, retain = false } = options;
  const mqtt = useMqttStore.getState();
  const inspect = useInspectStore.getState();

  // 상태 체크
  if (inspect.phase !== "idle") {
    logEvent({
      level: "WARN",
      source: "INSPECTION",
      event: "START_REJECTED",
      message: `Cannot start: already in ${inspect.phase} phase`,
    });
    return null;
  }

  // 상태 변경: 요청 중
  inspect.setPhase("requesting");
  
  // MQTT 메시지 발행
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  mqtt.publish(FMS_TOPICS.startReq, body, { qos, retain });
  
  logEvent({
    level: "INFO",
    source: "INSPECTION",
    event: "START_REQ",
    message: "startSystemCheck requested",
    details: { payload },
  });

  try {
    // 응답 대기
    const resp = await waitFor(FMS_TOPICS.startResp, timeoutMs);
    
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "START_ACK",
      message: "startSystemCheck acknowledged",
      details: { response: safeJsonOrText(resp) },
    });

    // 상태 변경: 실행 중
    inspect.setPhase("running");
    inspect.setStartedAt(Date.now());
    
    // 검사 시작
    startInspection();

    return safeJsonOrText(resp);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "INSPECTION",
      event: "START_FAIL",
      message: "startSystemCheck failed",
      details: { error: error.message },
    });
    
    // 상태 복원
    inspect.setPhase("idle");
    throw error;
  }
}

/**
 * 검사 종료 명령
 * @param {Function} waitFor - Promise 대기 함수
 * @param {Object} payload - 요청 페이로드
 * @param {Object} options - 옵션 { timeoutMs, qos, retain }
 * @returns {Promise<Object>} 응답 객체
 */
export async function stopSystemCheck(waitFor, payload = {}, options = {}) {
  const { timeoutMs = 10000, qos = 1, retain = false } = options;
  const mqtt = useMqttStore.getState();
  const inspect = useInspectStore.getState();

  // 상태 체크
  if (inspect.phase !== "running") {
    logEvent({
      level: "WARN",
      source: "INSPECTION",
      event: "STOP_REJECTED",
      message: `Cannot stop: not in running phase (current: ${inspect.phase})`,
    });
    return null;
  }

  // 상태 변경: 종료 중
  inspect.setPhase("stopping");
  
  // MQTT 메시지 발행
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  mqtt.publish(FMS_TOPICS.stopReq, body, { qos, retain });
  
  logEvent({
    level: "INFO",
    source: "INSPECTION",
    event: "STOP_REQ",
    message: "stopSystemCheck requested",
    details: { payload },
  });

  try {
    // 응답 대기
    const resp = await waitFor(FMS_TOPICS.stopResp, timeoutMs);
    
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "STOP_ACK",
      message: "stopSystemCheck acknowledged",
      details: { response: safeJsonOrText(resp) },
    });

    // 상태 변경: 대기
    inspect.setPhase("idle");
    
    // 검사 종료
    stopInspection();

    // 보고서 생성 (사용자 확인)
    await generateReport();

    return safeJsonOrText(resp);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "INSPECTION",
      event: "STOP_TIMEOUT",
      message: "stopSystemCheck timeout or failed",
      details: { error: error.message },
    });
    
    // 상태 복원
    inspect.setPhase("running");
    throw error;
  }
}

/**
 * 검사 시작 (내부)
 */
function startInspection() {
  const mqtt = useMqttStore.getState();
  
  // RSE 상태 토픽 구독
  mqtt.subscribeTopics([FMS_TOPICS.rseStatus], { qos: 1 });
  
  // 메모리 레코더 시작
  try {
    memoryRecorder.start();
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "RECORDER_START",
      message: "Memory recorder started",
    });
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "INSPECTION",
      event: "RECORDER_START_FAIL",
      message: "Failed to start memory recorder",
      details: { error: error.message },
    });
  }
}

/**
 * 검사 종료 (내부)
 */
function stopInspection() {
  const mqtt = useMqttStore.getState();
  
  // RSE 상태 토픽 구독 해제
  mqtt.unsubscribeTopics([FMS_TOPICS.rseStatus]);
  
  // 메모리 레코더 종료
  try {
    memoryRecorder.stop();
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "RECORDER_STOP",
      message: "Memory recorder stopped",
      details: memoryRecorder.getStats(),
    });
  } catch (error) {
    logEvent({
      level: "WARN",
      source: "INSPECTION",
      event: "RECORDER_STOP_FAIL",
      message: "Failed to stop memory recorder",
      details: { error: error.message },
    });
  }
}

/**
 * 유틸리티: 안전한 JSON 파싱
 */
function safeJsonOrText(buf) {
  const text = safeDecode(buf);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeDecode(buf) {
  try {
    return new TextDecoder().decode(buf);
  } catch {
    return "";
  }
}
