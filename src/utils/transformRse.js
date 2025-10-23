/**
 * 개선된 RSE 패킷 변환 유틸리티
 * - 보안/인증 경고 감지
 * - 통신 품질 경고
 */

import { rssiToBars } from "./signal";

/**
 * 헬스 체크 임계값
 */
const HEALTH_LIMITS = {
  CPU_MAX: 85,
  MEMORY_MAX: 85,
  DISK_MAX: 85,
  TEMP_MAX: 80,
};

/**
 * 경고 임계값
 */
const WARNING_THRESHOLDS = {
  CERT_EXPIRING_DAYS: 30,  // 인증서 만료 경고 (30일 이내)
  RSSI_WEAK: -100,          // 약한 신호 (dBm)
};

/**
 * 헬스 체크 항목 라벨
 */
const HEALTH_LABELS = {
  gnssAntenna: "GNSS 안테나",
  lteAntenna1: "LTE-V2X 안테나1",
  lteAntenna2: "LTE-V2X 안테나2",
  v2xUsb: "V2X USB",
  v2xSpi: "V2X SPI",
  sramVbat: "SRAM VBAT",
  ppsSync: "1PPS 동기",
  cpuOk: "CPU 사용률",
  memOk: "메모리 사용률",
  diskOk: "스토리지 사용률",
  tempOk: "온도",
};

/**
 * 헬스 요약 정보 계산
 */
export function computeHealthSummary(message) {
  if (!message) {
    return { pct: 0, flags: {}, issues: [] };
  }

  const flags = {
    gnssAntenna: !!message?.gnss_antenna_status,
    lteAntenna1: !!message?.ltev2x_antenna1_status,
    lteAntenna2: !!message?.ltev2x_antenna2_status,
    v2xUsb: !!message?.v2x_usb_status,
    v2xSpi: !!message?.v2x_spi_status,
    sramVbat: !!message?.sram_vbat_status,
    ppsSync: !!message?.secton_1pps_status,
  };

  const cpuUsage = Number(message?.cpu_usage_status?.cpu_usage_total_percent);
  const memUsage = Number(message?.memory_usage_status?.memory_usage_percent);
  const diskUsage = Number(message?.storage_usage_status?.storage_usage_percent);
  const temperature = Number(message?.temperature_status?.temperature_celsius);

  flags.cpuOk = Number.isFinite(cpuUsage) 
    ? cpuUsage <= HEALTH_LIMITS.CPU_MAX 
    : false;
  
  flags.memOk = Number.isFinite(memUsage) 
    ? memUsage <= HEALTH_LIMITS.MEMORY_MAX 
    : false;
  
  flags.diskOk = Number.isFinite(diskUsage) 
    ? diskUsage <= HEALTH_LIMITS.DISK_MAX 
    : false;
  
  flags.tempOk = Number.isFinite(temperature) 
    ? temperature <= HEALTH_LIMITS.TEMP_MAX 
    : false;

  const allKeys = Object.keys(flags);
  const okCount = allKeys.reduce((count, key) => count + (flags[key] ? 1 : 0), 0);
  const healthPercent = Math.round((okCount / allKeys.length) * 100);

  const issues = allKeys
    .filter((key) => !flags[key])
    .map((key) => HEALTH_LABELS[key] || key);

  return {
    pct: healthPercent,
    flags,
    issues,
  };
}

/**
 * 보안 및 인증 관련 경고 감지
 * @param {object} message - RSE 메시지 객체
 * @param {object} health - 헬스 요약
 * @returns {Array} 경고 목록
 */
export function detectSecurityWarnings(message, health) {
  const warnings = [];

  // 1. 보안 미적용
  const securityEnabled = !!message?.certificate?.ltev2x_cert_status_security_enable;
  if (!securityEnabled) {
    warnings.push({
      type: "SECURITY_DISABLED",
      severity: "WARNING",
      message: "보안이 적용되지 않았습니다",
      category: "security",
    });
  }

  // 2. 인증서 만료 확인
  const certDaysLeft = certDaysLeft2004(message?.certificate?.ltev2x_cert_valid_end);
  if (certDaysLeft !== null) {
    if (certDaysLeft <= 0) {
      warnings.push({
        type: "CERT_EXPIRED",
        severity: "WARNING",
        message: "인증서가 만료되었습니다",
        category: "certificate",
        daysLeft: certDaysLeft,
      });
    } else if (certDaysLeft < WARNING_THRESHOLDS.CERT_EXPIRING_DAYS) {
      warnings.push({
        type: "CERT_EXPIRING",
        severity: "WARNING",
        message: `인증서가 ${certDaysLeft}일 후 만료됩니다`,
        category: "certificate",
        daysLeft: certDaysLeft,
      });
    }
  }

  // 3. 통신 품질 경고
  const rssiDbm = Number(message?.lte?.rssi_dbm);
  if (Number.isFinite(rssiDbm) && rssiDbm < WARNING_THRESHOLDS.RSSI_WEAK) {
    const bars = rssiToBars(rssiDbm);
    warnings.push({
      type: "WEAK_SIGNAL",
      severity: "WARNING",
      message: `통신 신호가 약합니다 (${rssiDbm} dBm)`,
      category: "communication",
      rssi: rssiDbm,
      bars,
    });
  }

  // 4. 안테나 경고 (하나라도 문제있으면)
  if (!health.flags.gnssAntenna || !health.flags.lteAntenna1 || !health.flags.lteAntenna2) {
    const antennaIssues = [];
    if (!health.flags.gnssAntenna) antennaIssues.push("GNSS");
    if (!health.flags.lteAntenna1) antennaIssues.push("LTE-V2X #1");
    if (!health.flags.lteAntenna2) antennaIssues.push("LTE-V2X #2");
    
    warnings.push({
      type: "ANTENNA_ISSUE",
      severity: "WARNING",
      message: `안테나 문제: ${antennaIssues.join(", ")}`,
      category: "hardware",
      affected: antennaIssues,
    });
  }

  return warnings;
}

/**
 * 2004년 기준 Epoch에서 남은 일수 계산
 */
export function certDaysLeft2004(endSec) {
  const end = Number(endSec);
  
  if (!Number.isFinite(end)) {
    return null;
  }

  const epoch2004 = Date.UTC(2004, 0, 1);
  const endMillis = epoch2004 + end * 1000;
  const remainingMillis = endMillis - Date.now();
  
  return Math.ceil(remainingMillis / 86400000);
}

/**
 * GNSS 좌표 추출
 */
function extractCoordinates(message) {
  const latScaled = Number(message?.gnss_data?.latitude);
  const lonScaled = Number(message?.gnss_data?.longitude);

  if (Number.isFinite(latScaled) && Number.isFinite(lonScaled)) {
    return {
      lat: latScaled / 1e7,
      lon: lonScaled / 1e7,
    };
  }

  return null;
}

/**
 * 장치 활성 상태 판단
 */
function isDeviceActive(message) {
  return !!(
    message?.ltev2x_tx_ready_status || 
    message?.gnss_antenna_status
  );
}

/**
 * RSE 메시지를 표준 아이템 형식으로 변환
 * @param {object} message - RSE 원본 메시지
 * @param {string} canonicalId - 정규화된 장치 ID
 * @returns {object} 변환된 아이템 객체
 */
export function rseToItem(message, canonicalId) {
  if (!message) {
    return null;
  }

  const serial = String(message?.serial_number ?? "");
  const rssiDbm = Number(message?.lte?.rssi_dbm);
  const signalBars = Number.isFinite(rssiDbm) ? rssiToBars(rssiDbm) : 0;

  // 헬스 체크
  const healthSummary = computeHealthSummary(message);
  
  // 보안/인증 경고 감지
  const securityWarnings = detectSecurityWarnings(message, healthSummary);

  return {
    // 기본 정보
    id: canonicalId,
    serial,
    active: isDeviceActive(message),

    // 헬스 정보
    health: healthSummary,
    
    // ⭐ 보안 경고
    securityWarnings,

    // 신호 정보
    bars: signalBars,
    rssiDbm: Number.isFinite(rssiDbm) ? rssiDbm : null,

    // 보안/인증서
    securityEnabled: !!message?.certificate?.ltev2x_cert_status_security_enable,
    certDaysLeft: certDaysLeft2004(message?.certificate?.ltev2x_cert_valid_end),

    // 위치
    coords: extractCoordinates(message),

    // 시스템 리소스
    temperatureC: Number(message?.temperature_status?.temperature_celsius) || null,
    cpuTotalPct: Number(message?.cpu_usage_status?.cpu_usage_total_percent) || null,
    memUsedPct: Number(message?.memory_usage_status?.memory_usage_percent) || null,
    diskUsedPct: Number(message?.storage_usage_status?.storage_usage_percent) || null,

    // 메타데이터
    updatedAt: Date.now(),
    __raw: message,
  };
}

/**
 * 헬스 임계값 설정 업데이트
 */
export function updateHealthLimits(newLimits) {
  if (newLimits.CPU_MAX !== undefined) {
    HEALTH_LIMITS.CPU_MAX = Number(newLimits.CPU_MAX);
  }
  if (newLimits.MEMORY_MAX !== undefined) {
    HEALTH_LIMITS.MEMORY_MAX = Number(newLimits.MEMORY_MAX);
  }
  if (newLimits.DISK_MAX !== undefined) {
    HEALTH_LIMITS.DISK_MAX = Number(newLimits.DISK_MAX);
  }
  if (newLimits.TEMP_MAX !== undefined) {
    HEALTH_LIMITS.TEMP_MAX = Number(newLimits.TEMP_MAX);
  }
}

/**
 * 경고 임계값 설정 업데이트
 */
export function updateWarningThresholds(newThresholds) {
  if (newThresholds.CERT_EXPIRING_DAYS !== undefined) {
    WARNING_THRESHOLDS.CERT_EXPIRING_DAYS = Number(newThresholds.CERT_EXPIRING_DAYS);
  }
  if (newThresholds.RSSI_WEAK !== undefined) {
    WARNING_THRESHOLDS.RSSI_WEAK = Number(newThresholds.RSSI_WEAK);
  }
}

/**
 * 현재 헬스 임계값 조회
 */
export function getHealthLimits() {
  return { ...HEALTH_LIMITS };
}

/**
 * 현재 경고 임계값 조회
 */
export function getWarningThresholds() {
  return { ...WARNING_THRESHOLDS };
}

/**
 * 헬스 라벨 조회
 */
export function getHealthLabel(key) {
  return HEALTH_LABELS[key] || key;
}

/**
 * 모든 헬스 라벨 조회
 */
export function getAllHealthLabels() {
  return { ...HEALTH_LABELS };
}