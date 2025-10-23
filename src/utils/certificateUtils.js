// src/utils/certificateUtils.js

/**
 * 인증서 남은 일수 계산
 * @param {Object} certificate - 인증서 객체
 * @returns {number|null} - 남은 일수 (만료되었으면 음수), 정보 없으면 null
 */
export function calculateCertDaysLeft(certificate) {
  if (!certificate) return null;
  
  const validEnd = certificate.ltev2x_cert_valid_end;
  
  // validEnd가 0이거나 없으면 정보 없음
  if (!validEnd || validEnd === 0) return null;
  
  // ltev2x_cert_valid_end는 2004년 1월 1일 기준 초 단위
  // JavaScript Date는 1970년 기준이므로 변환 필요
  const SECONDS_FROM_1970_TO_2004 = 1072915200; // 2004-01-01 00:00:00 UTC
  const endTimestamp = (validEnd + SECONDS_FROM_1970_TO_2004) * 1000; // 밀리초로 변환
  
  const now = Date.now();
  const diffMs = endTimestamp - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * 인증서 활성화 여부 확인
 * @param {Object} certificate - 인증서 객체
 * @returns {boolean} - 활성화 여부
 */
export function isCertificateEnabled(certificate) {
  if (!certificate) return false;
  
  const enable = certificate.ltev2x_cert_status_security_enable;
  return enable === true || enable === 1 || enable === "1" || enable === "Y" || enable === "y";
}

/**
 * 인증서 상태 종합 확인
 * @param {Object} certificate - 인증서 객체
 * @returns {Object} - { enabled, daysLeft, isValid, isExpired }
 */
export function getCertificateStatus(certificate) {
  const enabled = isCertificateEnabled(certificate);
  const daysLeft = calculateCertDaysLeft(certificate);
  
  return {
    enabled,
    daysLeft,
    isValid: enabled && daysLeft !== null && daysLeft >= 0,
    isExpired: enabled && daysLeft !== null && daysLeft < 0,
    hasInfo: daysLeft !== null,
  };
}