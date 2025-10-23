/**
 * 장치 관련 유틸리티 함수 모음
 */

/**
 * 패킷 또는 IP 문자열에서 MQTT 연결용 IP 추출
 * @param {string|object} pktOrIp - IP 문자열 또는 패킷 객체
 * @returns {string|null} 추출된 IP 주소
 */
export function extractDeviceIp(pktOrIp) {
  // 문자열이면 그대로 반환
  if (typeof pktOrIp === "string" && pktOrIp.trim()) {
    return pktOrIp.trim();
  }

  // 패킷 객체에서 IP 추출
  try {
    const interfaces = pktOrIp?.interface_info?.interface_array;
    if (!Array.isArray(interfaces)) return null;

    // 1순위: ltev2x0 인터페이스
    const ltevInterface = interfaces.find(
      (iface) => iface?.name === "ltev2x0" && iface?.ip_addr
    );
    if (ltevInterface?.ip_addr) return ltevInterface.ip_addr;

    // 2순위: localhost가 아닌 첫 번째 인터페이스
    const primaryInterface = interfaces.find(
      (iface) => iface?.ip_addr && iface.ip_addr !== "127.0.0.1"
    );
    if (primaryInterface?.ip_addr) return primaryInterface.ip_addr;
  } catch (error) {
    console.error("IP 추출 실패:", error);
  }

  return null;
}

/**
 * ISO 8601 형식 날짜 문자열을 로컬 오프셋 포함하여 생성
 * @param {Date} date - 변환할 날짜 객체 (기본값: 현재 시간)
 * @returns {string} ISO 8601 형식의 날짜 문자열
 */
export function toISOWithLocalOffset(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return date.toISOString().replace("Z", `${sign}${hours}:${minutes}`);
}

let transactionCounter = 0;

/**
 * 트랜잭션 ID 생성 (타임스탬프 + 랜덤)
 * @returns {number} 유니크한 트랜잭션 ID
 */
export function generateTransactionId() {
  transactionCounter = (transactionCounter + 1) % 65536;
  return transactionCounter;
}

// 필요시 카운터 초기화
export function resetTransactionId() {
  transactionCounter = 0;
}

/**
 * ArrayBuffer를 Base64 문자열로 변환
 * @param {ArrayBuffer} buffer - 변환할 ArrayBuffer
 * @returns {string} Base64 인코딩된 문자열
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}