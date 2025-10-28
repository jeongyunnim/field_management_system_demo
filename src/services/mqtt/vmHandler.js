// src/services/mqtt/vmHandler.js

/**
 * 역할: VM(Virtual Machine) 상태 메시지 처리
 * 
 * 주요 기능:
 * - VM 상태 메시지 파싱
 * - VmStatusStore 업데이트
 * - 에러 처리
 */

import { useVmStatusStore } from "../../stores/VmStatusStore";
import { logEvent } from "../../core/logger";

/**
 * VM 상태 메시지 처리
 * @param {Buffer|Uint8Array} buf - MQTT 메시지 버퍼
 */
export function handleVmStatus(buf) {
  try {
    const msg = safeJsonOrText(buf);
    
    // VmStatusStore 업데이트
    useVmStatusStore.getState().setFromVmStatus(msg);
    
    logEvent({
      level: "DEBUG",
      source: "VM",
      event: "STATUS_UPDATE",
      message: "VM status updated",
    });
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "VM",
      event: "PARSE_FAIL",
      message: "Failed to parse VM status message",
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
