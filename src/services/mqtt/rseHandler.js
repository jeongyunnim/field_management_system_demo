// src/services/mqtt/rseHandler.js

/**
 * 역할: RSE 상태 메시지 처리
 * 
 * 주요 기능:
 * - 등록된 디바이스 상태 업데이트
 * - 미등록 디바이스 감지 및 경고
 * - 메모리 레코더에 데이터 저장
 * - 메트릭 업데이트
 */

import { isDeviceRegistered, getDeviceIdBySerial } from "../../dbms/deviceDb";
import { useRseStore } from "../../stores/RseStore";
import { useMetricsStore } from "../../stores/MetricsStore";
import { memoryRecorder } from "../../core/MemoryRecorder";
import { rseToItem } from "../../utils/transformRse";
import { logEvent } from "../../core/logger";

/**
 * RSE 상태 메시지 처리 (메인 핸들러)
 * @param {Buffer|Uint8Array} buf - MQTT 메시지 버퍼
 */
export async function handleRseStatus(buf) {
  try {
    const msg = safeJsonOrText(buf);
    const data = typeof msg === "string" ? JSON.parse(msg) : msg;
    
    const serial = data?.serial_number;
    
    if (!serial) {
      logEvent({
        level: "WARN",
        source: "RSE",
        event: "MISSING_SERIAL",
        message: "RSE status message missing serial_number",
        details: { data },
      });
      return;
    }

    // 디바이스 등록 여부 확인
    const isRegistered = await isDeviceRegistered(serial);
    
    if (!isRegistered) {
      handleUnregisteredDevice(serial, data);
      return;
    }

    await handleRegisteredDevice(serial, data);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "RSE",
      event: "PARSE_FAIL",
      message: "Failed to parse RSE status message",
      details: { error: error.message },
    });
  }
}

/**
 * 미등록 디바이스 처리
 * - 경고 로그 기록
 * - 통계용으로만 저장 (UI에 표시 안 함)
 * 
 * @param {string} serial - 시리얼 번호
 * @param {Object} data - RSE 데이터
 */
function handleUnregisteredDevice(serial, data) {
  logEvent({
    level: "WARN",
    source: "RSE",
    entity: serial,
    event: "UNREGISTERED_DEVICE",
    message: `Unregistered device detected: ${serial}`,
    details: {
      hardware_version: data.hardware_version,
      firmware_version: data.firmware_version,
    },
  });

  try {
    // 통계 목적으로만 저장 (MonitoringDeviceList에서 필터링됨)
    const unregisteredId = `unregistered_${serial}`;
    useRseStore.getState().upsertUnregisteredDevice(unregisteredId, serial, data);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "RSE",
      entity: serial,
      event: "UNREGISTERED_STORE_FAIL",
      message: "Failed to store unregistered device",
      details: { error: error.message },
    });
  }
}

/**
 * 등록된 디바이스 처리
 * - 전체 파싱 및 변환
 * - RseStore 업데이트
 * - 메모리 레코더에 기록
 * - 메트릭 업데이트
 * 
 * @param {string} serial - 시리얼 번호
 * @param {Object} data - RSE 데이터
 */
async function handleRegisteredDevice(serial, data) {
  try {
    // Canonical ID 조회
    const canonicalId = await getDeviceIdBySerial(serial);
    
    if (!canonicalId) {
      logEvent({
        level: "WARN",
        source: "RSE",
        entity: serial,
        event: "NO_CANONICAL_ID",
        message: "Canonical ID not found for registered device",
      });
      return;
    }

    // RSE 데이터를 UI 아이템으로 변환
    const item = rseToItem(data, canonicalId);

    // 1. RseStore 업데이트
    updateRseStore(item, serial, data);

    // 2. 메모리 레코더에 기록
    recordToMemory(data);

    // 3. 메트릭 업데이트
    updateMetrics(item);

    logEvent({
      level: "DEBUG",
      source: "RSE",
      entity: canonicalId,
      event: "STATUS_UPDATE",
      message: `Device status updated: ${serial}`,
    });
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "RSE",
      entity: serial,
      event: "REGISTERED_PROCESS_FAIL",
      message: "Failed to process registered device",
      details: { error: error.message },
    });
  }
}

/**
 * RseStore 업데이트
 * @param {Object} item - 변환된 아이템
 * @param {string} serial - 시리얼 번호
 * @param {Object} data - 원본 데이터
 */
function updateRseStore(item, serial, data) {
  try {
    useRseStore.getState().upsertRseStatus(item.id, serial, data);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "RSE",
      entity: item.id,
      event: "STORE_UPDATE_FAIL",
      message: "Failed to update RseStore",
      details: { error: error.message },
    });
  }
}

/**
 * 메모리 레코더에 기록
 * @param {Object} data - RSE 데이터
 */
function recordToMemory(data) {
  try {
    memoryRecorder.add(data, Date.now());
  } catch (error) {
    // 메모리 레코더 실패는 치명적이지 않음
    logEvent({
      level: "WARN",
      source: "RSE",
      event: "RECORDER_ADD_FAIL",
      message: "Failed to add to memory recorder",
      details: { error: error.message },
    });
  }
}

/**
 * 메트릭 업데이트
 * @param {Object} item - 변환된 아이템
 */
function updateMetrics(item) {
  try {
    useMetricsStore.getState().pushFromItem(item);
  } catch (error) {
    logEvent({
      level: "WARN",
      source: "RSE",
      entity: item.id,
      event: "METRICS_UPDATE_FAIL",
      message: "Failed to update metrics",
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

/**
 * 디바이스 등록 여부 일괄 확인 (최적화용)
 * @param {string[]} serials - 시리얼 번호 배열
 * @returns {Promise<Map<string, boolean>>} serial -> isRegistered
 */
export async function batchCheckRegistration(serials) {
  const results = new Map();
  
  await Promise.all(
    serials.map(async (serial) => {
      const isRegistered = await isDeviceRegistered(serial);
      results.set(serial, isRegistered);
    })
  );
  
  return results;
}
