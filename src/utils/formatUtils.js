/**
 * 디버그 및 포맷팅 관련 유틸리티 함수
 */

/**
 * 날짜를 로케일 문자열로 포맷
 * @param {Date|string|number} date - 포맷할 날짜
 * @param {string} fallback - 날짜가 유효하지 않을 때 기본값
 * @returns {string} 포맷된 날짜 문자열
 */
export function formatDate(date, fallback = "정보 없음") {
  if (!date) return fallback;
  try {
    return new Date(date).toLocaleString();
  } catch {
    return fallback;
  }
}

/**
 * 숫자를 퍼센트 문자열로 포맷
 * @param {number} value - 변환할 숫자
 * @param {number} decimals - 소수점 자릿수
 * @param {string} fallback - 유효하지 않을 때 기본값
 * @returns {string} 포맷된 퍼센트 문자열
 */
export function formatPercent(value, decimals = 3, fallback = "—") {
  return Number.isFinite(value) ? `${value.toFixed(decimals)}%` : fallback;
}

/**
 * 온도를 섭씨로 포맷
 * @param {number} value - 온도 값
 * @param {string} fallback - 유효하지 않을 때 기본값
 * @returns {string} 포맷된 온도 문자열
 */
export function formatTemperature(value, fallback = "—") {
  return Number.isFinite(value) ? `${value} ℃` : fallback;
}

/**
 * 좌표를 포맷
 * @param {object} coords - 좌표 객체 {lat, lon}
 * @param {number} decimals - 소수점 자릿수
 * @param {string} fallback - 유효하지 않을 때 기본값
 * @returns {string} 포맷된 좌표 문자열
 */
export function formatCoordinates(coords, decimals = 6, fallback = "—") {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
    return fallback;
  }
  return `${coords.lat.toFixed(decimals)}, ${coords.lon.toFixed(decimals)}`;
}

/**
 * RSSI를 dBm으로 포맷
 * @param {number} value - RSSI 값
 * @param {string} fallback - 유효하지 않을 때 기본값
 * @returns {string} 포맷된 RSSI 문자열
 */
export function formatRssi(value, fallback = "—") {
  return value != null ? `${value} dBm` : fallback;
}

/**
 * 인증서 만료 일수를 포맷
 * @param {number} daysLeft - 남은 일수
 * @param {string} fallback - 유효하지 않을 때 기본값
 * @returns {string} 포맷된 만료 문자열
 */
export function formatCertExpiry(daysLeft, fallback = "정보 없음") {
  if (!Number.isFinite(daysLeft)) return fallback;
  return daysLeft >= 0 ? `D-${daysLeft}` : `만료 ${-daysLeft}일`;
}

/**
 * JSON 데이터를 파일로 다운로드
 * @param {object} data - 다운로드할 데이터
 * @param {string} filename - 파일명
 * @returns {boolean} 성공 여부
 */
export function downloadJson(data, filename = "data.json") {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("JSON download failed:", error);
    return false;
  }
}

/**
 * 텍스트를 클립보드에 복사
 * @param {string} text - 복사할 텍스트
 * @returns {Promise<boolean>} 성공 여부
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    return false;
  }
}

/**
 * 안전하게 값을 추출 (null/undefined 처리)
 * @param {any} value - 추출할 값
 * @param {any} fallback - 기본값
 * @returns {any} 추출된 값 또는 기본값
 */
export function safeGet(value, fallback = null) {
  return value ?? fallback;
}

/**
 * 헬스 퍼센트 계산
 * @param {object|number} health - 헬스 정보
 * @returns {number} 헬스 퍼센트 (0-100)
 */
export function getHealthPercent(health) {
  if (!health) return 0;
  
  if (typeof health === "number" && Number.isFinite(health)) {
    return Number(health);
  }
  
  if (typeof health === "object") {
    return Number(health.healthPct ?? health.pct ?? 0);
  }
  
  return 0;
}

/**
 * 플래그 객체에서 실패한 항목 추출
 * @param {object} flags - 플래그 객체
 * @returns {array} 실패한 플래그 키 배열
 */
export function getFailedFlags(flags) {
  if (!flags || typeof flags !== "object") return [];
  
  return Object.entries(flags)
    .filter(([_, value]) => value === false)
    .map(([key]) => key);
}