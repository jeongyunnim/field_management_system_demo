// utils/transformRse.js
import { rssiToBars } from "./signal";

// 건강도는 Summary 객체로만 일관
export function computeHealthSummary(m) {
  const LIMITS = { cpuMax: 85, memMax: 85, diskMax: 85, tempMax: 80 };

  const flags = {
    gnssAntenna: !!m?.gnss_antenna_status,
    lteAntenna1: !!m?.ltev2x_antenna1_status,
    lteAntenna2: !!m?.ltev2x_antenna2_status,
    v2xUsb:      !!m?.v2x_usb_status,
    v2xSpi:      !!m?.v2x_spi_status,
    sramVbat:    !!m?.sram_vbat_status,
    ppsSync:     !!m?.secton_1pps_status,
  };

  const cpu  = Number(m?.cpu_usage_status?.cpu_usage_total_percent);
  const mem  = Number(m?.memory_usage_status?.memory_usage_percent);
  const disk = Number(m?.storage_usage_status?.storage_usage_percent);
  const temp = Number(m?.temperature_status?.temperature_celsius);

  flags.cpuOk  = Number.isFinite(cpu)  ? cpu  <= LIMITS.cpuMax  : false;
  flags.memOk  = Number.isFinite(mem)  ? mem  <= LIMITS.memMax  : false;
  flags.diskOk = Number.isFinite(disk) ? disk <= LIMITS.diskMax : false;
  flags.tempOk = Number.isFinite(temp) ? temp <= LIMITS.tempMax : false;

  const keys = Object.keys(flags);
  const okCount = keys.reduce((a, k) => a + (flags[k] ? 1 : 0), 0);
  const pct = Math.round((okCount / keys.length) * 100);

  const labels = {
    gnssAntenna: "GNSS 안테나",
    lteAntenna1: "LTE-V2X 안테나1",
    lteAntenna2: "LTE-V2X 안테나2",
    v2xUsb:      "V2X USB",
    v2xSpi:      "V2X SPI",
    sramVbat:    "SRAM VBAT",
    ppsSync:     "1PPS 동기",
    cpuOk:       "CPU 사용률",
    memOk:       "메모리 사용률",
    diskOk:      "스토리지 사용률",
    tempOk:      "온도",
  };
  const issues = keys.filter(k => !flags[k]).map(k => labels[k] || k);
  return { pct, flags, issues };
}

export function certDaysLeft2004(endSec) {
  const end = Number(endSec);
  if (!Number.isFinite(end)) return null;
  const epoch2004 = Date.UTC(2004, 0, 1);
  return Math.ceil((epoch2004 + end * 1000 - Date.now()) / 86400000);
}

function pickCoords(m) {
  const latScaled = Number(m?.gnss_data?.latitude);
  const lonScaled = Number(m?.gnss_data?.longitude);
  if (Number.isFinite(latScaled) && Number.isFinite(lonScaled)) {
    return { lat: latScaled / 1e7, lon: lonScaled / 1e7 };
  }
  return null;
}

export function rseToItem(m, canonicalId) {
  const serial = String(m?.serial_number ?? "");
  const rssiDbm = Number(m?.lte?.rssi_dbm);
  const bars = Number.isFinite(rssiDbm) ? rssiToBars(rssiDbm) : 0;

  return {
    id: canonicalId,
    serial,

    active: !!(m?.ltev2x_tx_ready_status || m?.gnss_antenna_status),

    // 건강도: 객체
    health: computeHealthSummary(m),

    bars,
    // GNSS 품질 막대만
    rssiDbm,

    securityEnabled: !!m?.certificate?.ltev2x_cert_status_security_enable,
    certDaysLeft: certDaysLeft2004(m?.certificate?.ltev2x_cert_valid_end),

    coords: pickCoords(m),
    temperatureC: Number(m?.temperature_status?.temperature_celsius) || null,
    cpuTotalPct: Number(m?.cpu_usage_status?.cpu_usage_total_percent) || null,
    memUsedPct: Number(m?.memory_usage_status?.memory_usage_percent) || null,
    diskUsedPct: Number(m?.storage_usage_status?.storage_usage_percent) || null,

    updatedAt: Date.now(),
    __raw: m,
  };
}
