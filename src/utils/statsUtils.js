/**
 * 개선된 시스템 통계 계산 유틸리티
 * - 미등록 장치 추적
 * - 명확한 장애/경고 분류
 * - 보안/인증 문제 감지
 */

/**
 * 장치 상태 분류
 */
export const DEVICE_STATUS = {
  OK: "ok",           // 정상: 헬스 100%, 모든 체크 통과
  FAULT: "fault",     // 장애: 헬스 <70%, 치명적 하드웨어 문제
  WARNING: "warning", // 경고: 헬스 70-99%, 보안/인증 문제
  UNKNOWN: "unknown", // 미확인: 미등록 또는 헬스 정보 없음
  INACTIVE: "inactive", // 비활성: 통신 끊김
};

/**
 * 상태별 색상 정의
 */
export const STATUS_COLORS = {
  [DEVICE_STATUS.OK]: "#28B555",      // 초록색
  [DEVICE_STATUS.FAULT]: "#FF4D4D",   // 빨간색
  [DEVICE_STATUS.WARNING]: "#FFA041", // 주황색
  [DEVICE_STATUS.UNKNOWN]: "#94A3B8", // 회색
  [DEVICE_STATUS.INACTIVE]: "#64748B", // 어두운 회색
};

/**
 * 상태별 레이블
 */
export const STATUS_LABELS = {
  [DEVICE_STATUS.OK]: "정상",
  [DEVICE_STATUS.FAULT]: "장애",
  [DEVICE_STATUS.WARNING]: "경고",
  [DEVICE_STATUS.UNKNOWN]: "미확인",
  [DEVICE_STATUS.INACTIVE]: "비활성",
};

/**
 * 장치의 상태를 결정
 * @param {object} device - 장치 객체
 * @returns {string} 장치 상태 (DEVICE_STATUS)
 */
export function determineDeviceStatus(device) {
  if (!device) return DEVICE_STATUS.UNKNOWN;

  // 1. 미등록 장치 → 미확인
  if (device.isRegistered === false) {
    return DEVICE_STATUS.UNKNOWN;
  }

  // 2. 비활성 장치
  if (!device.active) {
    return DEVICE_STATUS.INACTIVE;
  }

  // 3. 헬스 정보가 없는 경우 → 미확인
  if (!device.health) {
    return DEVICE_STATUS.UNKNOWN;
  }

  const healthPercent = typeof device.health === "object"
    ? Number(device.health.pct ?? device.health.healthPct ?? 0)
    : Number(device.health);

  // 4. 헬스 퍼센트가 유효하지 않은 경우 → 미확인
  if (!Number.isFinite(healthPercent)) {
    return DEVICE_STATUS.UNKNOWN;
  }

  // 5. 치명적 장애 (헬스 < 100%)
  if (healthPercent < 100) {
    return DEVICE_STATUS.FAULT;
  }

  // 6. 경고 (헬스 70-99% 또는 보안 경고 존재)
  const hasSecurityWarnings = Array.isArray(device.securityWarnings) && 
                              device.securityWarnings.length > 0;
  
  if (healthPercent < 100 || hasSecurityWarnings) {
    return DEVICE_STATUS.WARNING;
  }

  // 7. 정상 (헬스 100%, 경고 없음)
  return DEVICE_STATUS.OK;
}

/**
 * 장치 목록의 통계 계산
 * @param {Array} devices - 장치 배열
 * @returns {object} 통계 객체
 */
export function calculateDeviceStatistics(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return {
      total: 0,
      registered: 0,
      unregistered: 0,
      ok: 0,
      fault: 0,
      warning: 0,
      unknown: 0,
      inactive: 0,
      activeCount: 0,
      okPercent: 0,
      faultPercent: 0,
      warningPercent: 0,
      unknownPercent: 0,
      inactivePercent: 0,
    };
  }

  const statusCounts = {
    [DEVICE_STATUS.OK]: 0,
    [DEVICE_STATUS.FAULT]: 0,
    [DEVICE_STATUS.WARNING]: 0,
    [DEVICE_STATUS.UNKNOWN]: 0,
    [DEVICE_STATUS.INACTIVE]: 0,
  };

  let registeredCount = 0;
  let unregisteredCount = 0;

  // 각 장치의 상태 집계
  devices.forEach((device) => {
    const status = determineDeviceStatus(device);
    statusCounts[status]++;

    // 등록 여부 카운트
    if (device.isRegistered === false) {
      unregisteredCount++;
    } else {
      registeredCount++;
    }
  });

  const total = devices.length;
  const activeCount = total - statusCounts[DEVICE_STATUS.INACTIVE];

  return {
    total,
    registered: registeredCount,
    unregistered: unregisteredCount,
    ok: statusCounts[DEVICE_STATUS.OK],
    fault: statusCounts[DEVICE_STATUS.FAULT],
    warning: statusCounts[DEVICE_STATUS.WARNING],
    unknown: statusCounts[DEVICE_STATUS.UNKNOWN],
    inactive: statusCounts[DEVICE_STATUS.INACTIVE],
    activeCount,
    
    // 퍼센트 계산 (활성 장치 기준)
    okPercent: activeCount > 0 
      ? Math.round((statusCounts[DEVICE_STATUS.OK] / activeCount) * 100) 
      : 0,
    faultPercent: activeCount > 0 
      ? Math.round((statusCounts[DEVICE_STATUS.FAULT] / activeCount) * 100) 
      : 0,
    warningPercent: activeCount > 0 
      ? Math.round((statusCounts[DEVICE_STATUS.WARNING] / activeCount) * 100) 
      : 0,
    unknownPercent: activeCount > 0 
      ? Math.round((statusCounts[DEVICE_STATUS.UNKNOWN] / activeCount) * 100) 
      : 0,
    inactivePercent: total > 0 
      ? Math.round((statusCounts[DEVICE_STATUS.INACTIVE] / total) * 100) 
      : 0,
  };
}

/**
 * 차트 표시용 데이터 생성
 * @param {object} stats - 통계 객체
 * @returns {Array} 차트 데이터 배열
 */
export function generateChartData(stats) {
  return [
    {
      key: DEVICE_STATUS.OK,
      label: STATUS_LABELS[DEVICE_STATUS.OK],
      value: stats.ok,
      percent: stats.okPercent,
      color: STATUS_COLORS[DEVICE_STATUS.OK],
    },
    {
      key: DEVICE_STATUS.FAULT,
      label: STATUS_LABELS[DEVICE_STATUS.FAULT],
      value: stats.fault,
      percent: stats.faultPercent,
      color: STATUS_COLORS[DEVICE_STATUS.FAULT],
    },
    {
      key: DEVICE_STATUS.WARNING,
      label: STATUS_LABELS[DEVICE_STATUS.WARNING],
      value: stats.warning,
      percent: stats.warningPercent,
      color: STATUS_COLORS[DEVICE_STATUS.WARNING],
    },
    {
      key: DEVICE_STATUS.UNKNOWN,
      label: STATUS_LABELS[DEVICE_STATUS.UNKNOWN],
      value: stats.unknown,
      percent: stats.unknownPercent,
      color: STATUS_COLORS[DEVICE_STATUS.UNKNOWN],
    },
  ];
}

/**
 * 상태별 장치 필터링
 * @param {Array} devices - 장치 배열
 * @param {string} status - 필터링할 상태
 * @returns {Array} 필터링된 장치 배열
 */
export function filterDevicesByStatus(devices, status) {
  return devices.filter((device) => determineDeviceStatus(device) === status);
}

/**
 * 미등록 장치 필터링
 * @param {Array} devices - 장치 배열
 * @returns {Array} 미등록 장치 배열
 */
export function filterUnregisteredDevices(devices) {
  return devices.filter((device) => device.isRegistered === false);
}

/**
 * 보안 경고가 있는 장치 필터링
 * @param {Array} devices - 장치 배열
 * @returns {Array} 보안 경고 장치 배열
 */
export function filterDevicesWithSecurityWarnings(devices) {
  return devices.filter((device) => 
    Array.isArray(device.securityWarnings) && 
    device.securityWarnings.length > 0
  );
}

/**
 * 통계 요약 텍스트 생성
 * @param {object} stats - 통계 객체
 * @returns {string} 요약 텍스트
 */
export function generateStatsSummary(stats) {
  const { total, registered, unregistered, activeCount, ok, fault, warning, unknown } = stats;
  
  if (total === 0) {
    return "등록된 장치가 없습니다.";
  }

  if (activeCount === 0) {
    return `총 ${total}대의 장치가 모두 비활성 상태입니다.`;
  }

  const parts = [
    `총 ${total}대`,
    registered > 0 && `등록 ${registered}대`,
    ok > 0 && `정상 ${ok}대`,
    fault > 0 && `장애 ${fault}대`,
    warning > 0 && `경고 ${warning}대`,
    unknown > 0 && `미확인 ${unknown}대`,
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * 보안 경고 요약
 * @param {Array} devices - 장치 배열
 * @returns {object} 보안 경고 요약
 */
export function summarizeSecurityWarnings(devices) {
  const warningTypes = {};
  let totalWarnings = 0;

  devices.forEach((device) => {
    if (Array.isArray(device.securityWarnings)) {
      device.securityWarnings.forEach((warning) => {
        const type = warning.type || "UNKNOWN";
        warningTypes[type] = (warningTypes[type] || 0) + 1;
        totalWarnings++;
      });
    }
  });

  return {
    total: totalWarnings,
    byType: warningTypes,
    affectedDevices: filterDevicesWithSecurityWarnings(devices).length,
  };
}

/**
 * 장치 우선순위 정렬 (장애 > 경고 > 미확인 > 정상)
 * @param {Array} devices - 장치 배열
 * @returns {Array} 정렬된 장치 배열
 */
export function sortDevicesByPriority(devices) {
  const priorityMap = {
    [DEVICE_STATUS.FAULT]: 1,
    [DEVICE_STATUS.WARNING]: 2,
    [DEVICE_STATUS.UNKNOWN]: 3,
    [DEVICE_STATUS.OK]: 4,
    [DEVICE_STATUS.INACTIVE]: 5,
  };

  return [...devices].sort((a, b) => {
    const statusA = determineDeviceStatus(a);
    const statusB = determineDeviceStatus(b);
    return priorityMap[statusA] - priorityMap[statusB];
  });
}