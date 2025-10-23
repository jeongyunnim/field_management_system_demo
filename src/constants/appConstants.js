/**
 * 애플리케이션 전역 상수
 */

// MQTT 토픽
export const MQTT_TOPICS = {
  TAMPER_ENABLE: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/TAMPER_SECURE_PA/tamperSecureEnable/req",
  TAMPER_DISABLE: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/TAMPER_SECURE_PA/tamperSecureDisable/req",
  
  CERT_APPLY_REQ: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SS_DOT2_SVC_PA/ssDot2ApplyDot2BundleCertZip/req",
  CERT_APPLY_RES: "fac/SS_DOT2_SVC_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/ssDot2ApplyDot2BundleCertZip/resp",

  REBOOT_REQ: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SYS_CTRL_PA/systemRestart/req",
  REBOOT_RES: "fac/SYS_CTRL_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/systemRestart/resp",
};

// 타임아웃 설정 (ms)
export const TIMEOUTS = {
  DEFAULT: 6000,
  MQTT_CONNECT: 5000,
  CERT_UPLOAD: 12000,
};

// 헬스 체크 항목 라벨
export const HEALTH_CHECK_LABELS = {
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

// UI 스타일 클래스
export const TILE_STYLES = {
  BASE: "h-36 col-span-2 device-inspection-icon-btn transition-colors",
  OK: "bg-emerald-900/90 ring-1 ring-emerald-500/30",
  WARN: "bg-amber-900/90 ring-1",
};

// 인증서 상태
export const CERT_STATES = {
  OK: "ok",
  EXPIRED: "expired",
  DISABLED: "disabled",
  UNKNOWN: "unknown",
};