// src/services/mqtt/inspectionController.js
import { FMS_TOPICS } from "./bus";
import { useMqttStore } from "../../stores/MqttStore";
import { useInspectStore } from "../../stores/InspectStore";
import { memoryRecorder } from "../../core/MemoryRecorder";
import { logEvent } from "../../core/logger";
import { generateReport } from "./reportController";

// 주기적 전송 설정
const PERIODIC_CONFIG = {
  sendInterval: 1000,        // 전송 간격 (1초)
  firstResponseTimeout: 3000, // 첫 응답 대기 타임아웃 (3초)
};

// 전역 인터벌 ID (점검 중단 시 정리용)
let activeIntervalId = null;

/**
 * 검사 시작 명령 (지속적 주기 전송 방식)
 * - 점검 시작 버튼 클릭 시 1초마다 시작 요청을 전송
 * - 첫 응답이 올 때까지 최대 3초 대기
 * - 첫 응답 후에도 점검 중단까지 계속 전송
 * - rseStatus 토픽 구독 시작
 * 
 * @param {Function} waitFor - Promise 대기 함수
 * @param {Object} payload - 요청 페이로드
 * @param {Object} options - 옵션 { qos, retain }
 * @returns {Promise<Object>} 응답 객체
 */
export async function startSystemCheck(waitFor, payload = {}, options = {}) {
  const { qos = 1, retain = false } = options;
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

  // MQTT 연결 체크
  if (!mqtt.connected) {
    logEvent({
      level: "ERROR",
      source: "INSPECTION",
      event: "START_REJECTED",
      message: "MQTT not connected",
    });
    showFmsConnectionError("MQTT 연결이 끊어졌습니다. 재연결 후 다시 시도해주세요.");
    return null;
  }

  // 이미 활성 인터벌이 있으면 정리
  if (activeIntervalId !== null) {
    clearInterval(activeIntervalId);
    activeIntervalId = null;
  }

  // 상태 변경: 요청 중
  inspect.setPhase("requesting");
  inspect.resetRetry();
  
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  
  let attemptCount = 0;
  let firstResponseReceived = false;

  console.log(`[startSystemCheck] Starting continuous periodic send (${PERIODIC_CONFIG.sendInterval}ms interval)`);

  return new Promise((resolve, reject) => {
    // 주기적 전송 함수
    const sendRequest = () => {
      attemptCount++;
      inspect.incrementRetry();
      
      // MQTT 메시지 발행
      const published = mqtt.publish(FMS_TOPICS.startReq, body, { qos, retain });
      
      if (published) {
        logEvent({
          level: "INFO",
          source: "INSPECTION",
          event: "START_REQ",
          message: `startSystemCheck request sent (attempt ${attemptCount})`,
        });
      } else {
        logEvent({
          level: "WARN",
          source: "INSPECTION",
          event: "START_PUBLISH_FAIL",
          message: `Failed to publish startReq (attempt ${attemptCount})`,
        });
      }
    };

    // 첫 응답 타임아웃 설정 (3초)
    const timeoutId = setTimeout(() => {
      if (!firstResponseReceived) {
        console.log(`[startSystemCheck] First response timeout after ${attemptCount} attempts`);
        
        // 인터벌 중단
        if (activeIntervalId !== null) {
          clearInterval(activeIntervalId);
          activeIntervalId = null;
        }
        
        // 타임아웃 실패
        logEvent({
          level: "ERROR",
          source: "INSPECTION",
          event: "START_FAIL",
          message: `startSystemCheck timeout: no response within ${PERIODIC_CONFIG.firstResponseTimeout}ms`,
          details: { 
            attempts: attemptCount,
            timeout: PERIODIC_CONFIG.firstResponseTimeout
          },
        });
        
        // 상태 복원
        inspect.setPhase("idle");
        inspect.resetRetry();
        
        // FMS 연결 에러 표시
        showFmsConnectionError(
          `FMS 응답이 없습니다.\n${attemptCount}회 시도 후 연결에 실패했습니다.\n\n시스템 관리자에게 문의하세요.`
        );
        
        reject(new Error("FMS connection timeout"));
      }
    }, PERIODIC_CONFIG.firstResponseTimeout);

    // 인터벌 설정 (점검 중단까지 계속 전송)
    activeIntervalId = setInterval(sendRequest, PERIODIC_CONFIG.sendInterval);
    console.log(`[startSystemCheck] Interval set with ID: ${activeIntervalId}`);
    
    // 첫 전송은 즉시 실행
    sendRequest();
    
    // 첫 응답 대기
    console.log(`[startSystemCheck] Waiting for first response`);
    waitFor(FMS_TOPICS.startResp, PERIODIC_CONFIG.firstResponseTimeout)
      .then((resp) => {
        if (!firstResponseReceived) {
          firstResponseReceived = true;
          
          console.log(`[startSystemCheck] First response received after ${attemptCount} attempts`);
          
          // 타임아웃 타이머만 정리 (인터벌은 유지)
          clearTimeout(timeoutId);
          
          logEvent({
            level: "INFO",
            source: "INSPECTION",
            event: "START_ACK",
            message: `startSystemCheck acknowledged after ${attemptCount} attempts`,
          });

          // 성공: 상태 변경 및 검사 시작
          inspect.setPhase("running");
          inspect.setStartedAt(Date.now());
          inspect.resetRetry();
          
          // rseStatus 구독 시작
          startInspection();
          
          resolve(safeJsonOrText(resp));
        }
      })
      .catch((error) => {
        // waitFor 자체의 타임아웃은 전체 타임아웃이 처리
        if (!firstResponseReceived) {
          console.log(`[startSystemCheck] waitFor error:`, error.message);
          logEvent({
            level: "ERROR",
            source: "INSPECTION",
            event: "START_WAIT_ERROR",
            message: "waitFor error",
            details: { error: error.message },
          });
        }
      });
  });
}

/**
 * 검사 종료 명령
 * - 주기적 전송 인터벌 중단
 * - rseStatus 토픽 구독 해제
 * - 보고서 생성
 * @returns {Promise<void>}
 */
export async function stopSystemCheck() {
  const inspect = useInspectStore.getState();
  const mqtt = useMqttStore.getState();

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
  
  // 인터벌 중단
  if (activeIntervalId !== null) {
    clearInterval(activeIntervalId);
    activeIntervalId = null;
    console.log("[stopSystemCheck] Periodic sending interval cleared");
    
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "INTERVAL_CLEARED",
      message: "Periodic sending interval stopped",
    });
  }
  
  logEvent({
    level: "INFO",
    source: "INSPECTION",
    event: "STOP_REQ",
    message: "System Check stopped.",
  });
  
  // 검사 종료 (rseStatus 구독 해제 포함)
  stopInspection();
  inspect.setPhase("idle");

  // 보고서 생성
  try {
    await generateReport();
    
    logEvent({
      level: "INFO",
      source: "INSPECTION",
      event: "REPORT_GENERATED",
      message: "Inspection report generated successfully",
    });
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "INSPECTION",
      event: "REPORT_GENERATION_FAIL",
      message: "Failed to generate report",
      details: { error: error.message },
    });
  }
}

/**
 * FMS 연결 에러 표시
 * @param {string} message - 에러 메시지
 */
function showFmsConnectionError(message) {
  logEvent({
    level: "ERROR",
    source: "INSPECTION",
    event: "FMS_CONNECTION_ERROR",
    message,
  });

  // InspectStore에 에러 상태 저장
  useInspectStore.getState().setError(message);
  
  // 브라우저 콘솔에 에러 표시
  if (process.env.NODE_ENV !== "production") {
    console.error("FMS 연결 오류:", message);
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
 * - 메모리 레코더 종료
 * - rseStatus 토픽 구독 해제
 */
function stopInspection() {
  const mqtt = useMqttStore.getState();
  
  // RSE 상태 토픽 구독 해제
  mqtt.unsubscribeTopics([FMS_TOPICS.rseStatus]);
  
  logEvent({
    level: "INFO",
    source: "INSPECTION",
    event: "UNSUBSCRIBE_RSE",
    message: "Unsubscribed from rseStatus topic",
  });
  
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