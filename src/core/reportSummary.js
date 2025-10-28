// src/core/reportSummary.js

/**
 * 역할: CSV 보고서 상단에 표시될 종합 정보를 생성합니다.
 * 
 * 주요 기능:
 * - 수집된 패킷들의 통계 계산 (평균, 최소, 최대)
 * - 하드웨어 건강도 체크
 * - 시스템 버전 정보 요약
 * - 이상 상황 감지 및 경고
 */

import { N } from "../utils/csvHelpers";

/**
 * 패킷 배열로부터 종합 정보 생성
 * @param {Array} packets - 원본 패킷 객체 배열
 * @returns {Object} 종합 정보 객체
 */
export function generateSummary(packets) {
  if (!packets || packets.length === 0) {
    return createEmptySummary();
  }

  const firstPacket = packets[0];
  const lastPacket = packets[packets.length - 1];

  return {
    // 기본 정보
    meta: extractMetaInfo(firstPacket, lastPacket, packets.length),
    
    // 하드웨어 상태 통계
    hardware: calculateHardwareStats(packets),
    
    // 성능 통계
    performance: calculatePerformanceStats(packets),
    
    // 위치 정보 통계
    location: calculateLocationStats(packets),
    
    // 인증서 정보
    certificate: extractCertificateInfo(firstPacket),
    
    // 경고 및 이슈
    alerts: detectAlerts(packets),
  };
}

/**
 * 메타 정보 추출 (시리얼, 버전, 수집 시간)
 */
function extractMetaInfo(firstPacket, lastPacket, totalPackets) {
  const firstGnss = firstPacket?.gnss_data ?? {};
  const lastGnss = lastPacket?.gnss_data ?? {};

  return {
    serial_number: firstPacket?.serial_number ?? "N/A",
    hardware_version: firstPacket?.hardware_version ?? "N/A",
    os_version: firstPacket?.os_version ?? "N/A",
    firmware_version: firstPacket?.firmware_version ?? "N/A",
    
    total_packets: totalPackets,
    
    first_timestamp: formatGnssTime(firstGnss),
    last_timestamp: formatGnssTime(lastGnss),
    
    duration_seconds: calculateDuration(firstGnss, lastGnss),
  };
}

/**
 * 하드웨어 상태 통계 계산
 */
function calculateHardwareStats(packets) {
  const checks = {
    gnss_antenna: [],
    ltev2x_ant1: [],
    ltev2x_ant2: [],
    pps_sync: [],
    temperature: [],
    v2x_usb: [],
    v2x_spi: [],
    sram_vbat: [],
    ltev2x_tx_ready: [],
    tamper_secure: [],
  };

  for (const pkt of packets) {
    checks.gnss_antenna.push(pkt.gnss_antenna_status === true);
    checks.ltev2x_ant1.push(pkt.ltev2x_antenna1_status === true);
    checks.ltev2x_ant2.push(pkt.ltev2x_antenna2_status === true);
    checks.pps_sync.push(pkt.secton_1pps_status === true);
    checks.temperature.push(pkt.temperature_status?.temperature_status === true);
    checks.v2x_usb.push(pkt.v2x_usb_status === true);
    checks.v2x_spi.push(pkt.v2x_spi_status === true);
    checks.sram_vbat.push(pkt.sram_vbat_status === true);
    checks.ltev2x_tx_ready.push(pkt.ltev2x_tx_ready_status === true);
    checks.tamper_secure.push(pkt.tamper_secure_status === true);
  }

  const result = {};
  for (const [key, values] of Object.entries(checks)) {
    const okCount = values.filter(v => v).length;
    const totalCount = values.length;
    result[`${key}_ok_rate`] = N((okCount / totalCount) * 100, 2);
  }

  // 전체 하드웨어 건강도
  const allChecks = Object.values(checks).flat();
  const allOkCount = allChecks.filter(v => v).length;
  result.overall_health_pct = N((allOkCount / allChecks.length) * 100, 2);

  return result;
}

/**
 * 성능 통계 계산 (CPU, 메모리, 스토리지)
 */
function calculatePerformanceStats(packets) {
  const cpuUsages = [];
  const memUsages = [];
  const storUsages = [];
  const temps = [];

  for (const pkt of packets) {
    const cpu = pkt.cpu_usage_status?.cpu_usage_total_percent;
    const mem = pkt.memory_usage_status?.memory_usage_percent;
    const stor = pkt.storage_usage_status?.storage_usage_percent;
    const temp = pkt.temperature_status?.temperature_celsius;

    if (Number.isFinite(cpu)) cpuUsages.push(cpu);
    if (Number.isFinite(mem)) memUsages.push(mem);
    if (Number.isFinite(stor)) storUsages.push(stor);
    if (Number.isFinite(temp)) temps.push(temp);
  }

  return {
    cpu_avg: N(avg(cpuUsages), 2),
    cpu_min: N(min(cpuUsages), 2),
    cpu_max: N(max(cpuUsages), 2),
    
    mem_avg: N(avg(memUsages), 2),
    mem_min: N(min(memUsages), 2),
    mem_max: N(max(memUsages), 2),
    
    storage_avg: N(avg(storUsages), 2),
    storage_min: N(min(storUsages), 2),
    storage_max: N(max(storUsages), 2),
    
    temp_avg: N(avg(temps), 1),
    temp_min: N(min(temps), 1),
    temp_max: N(max(temps), 1),
  };
}

/**
 * 위치 정보 통계 계산
 */
function calculateLocationStats(packets) {
  const lats = [];
  const lons = [];
  const alts = [];
  const speeds = [];
  const sats = [];
  const hdops = [];

  for (const pkt of packets) {
    const g = pkt.gnss_data ?? {};
    
    if (Number.isFinite(g.latitude)) lats.push(g.latitude / 1e7);
    if (Number.isFinite(g.longitude)) lons.push(g.longitude / 1e7);
    if (Number.isFinite(g.altMSL)) alts.push(g.altMSL / 100);
    if (Number.isFinite(g.speed)) speeds.push(g.speed * 0.036);
    if (Number.isFinite(g.numUsedSatellites)) sats.push(g.numUsedSatellites);
    if (Number.isFinite(g.hdop)) hdops.push(Number(g.hdop));
  }

  return {
    lat_avg: N(avg(lats), 7),
    lon_avg: N(avg(lons), 7),
    alt_avg_m: N(avg(alts), 2),
    
    speed_avg_kmh: N(avg(speeds), 2),
    speed_max_kmh: N(max(speeds), 2),
    
    sats_avg: N(avg(sats), 1),
    sats_min: N(min(sats), 0),
    
    hdop_avg: N(avg(hdops), 3),
    hdop_max: N(max(hdops), 3),
  };
}

/**
 * 인증서 정보 추출
 */
function extractCertificateInfo(firstPacket) {
  const cert = firstPacket?.certificate ?? {};
  
  return {
    security_enabled: cert.ltev2x_cert_status_security_enable ? "YES" : "NO",
    valid_start: cert.ltev2x_cert_valid_start ?? 0,
    valid_end: cert.ltev2x_cert_valid_end ?? 0,
  };
}

/**
 * 경고 및 이슈 감지
 */
function detectAlerts(packets) {
  const alerts = [];

  // 하드웨어 체크
  const hwStats = calculateHardwareStats(packets);
  if (parseFloat(hwStats.overall_health_pct) < 95) {
    alerts.push(`Hardware health below 95%: ${hwStats.overall_health_pct}%`);
  }

  // 성능 체크
  const perfStats = calculatePerformanceStats(packets);
  if (parseFloat(perfStats.cpu_max) > 90) {
    alerts.push(`High CPU usage detected: ${perfStats.cpu_max}%`);
  }
  if (parseFloat(perfStats.mem_max) > 80) {
    alerts.push(`High memory usage detected: ${perfStats.mem_max}%`);
  }
  if (parseFloat(perfStats.temp_max) > 70) {
    alerts.push(`High temperature detected: ${perfStats.temp_max}°C`);
  }

  // GNSS 체크
  const locStats = calculateLocationStats(packets);
  if (parseFloat(locStats.sats_min) < 5) {
    alerts.push(`Low satellite count detected: ${locStats.sats_min} sats`);
  }

  return alerts.length > 0 ? alerts : ["No critical alerts"];
}

/**
 * 빈 요약 정보 생성
 */
function createEmptySummary() {
  return {
    meta: { total_packets: 0 },
    hardware: {},
    performance: {},
    location: {},
    certificate: {},
    alerts: ["No data available"],
  };
}

/**
 * 유틸리티 함수들
 */
function avg(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
}

function min(arr) {
  return arr.length > 0 ? Math.min(...arr) : NaN;
}

function max(arr) {
  return arr.length > 0 ? Math.max(...arr) : NaN;
}

function formatGnssTime(gnss) {
  if (!gnss || !gnss.year) return "N/A";
  return `${gnss.year}-${String(gnss.month).padStart(2, '0')}-${String(gnss.day).padStart(2, '0')} ${String(gnss.hour).padStart(2, '0')}:${String(gnss.min).padStart(2, '0')}:${String(gnss.sec).padStart(2, '0')}`;
}

function calculateDuration(firstGnss, lastGnss) {
  if (!firstGnss.year || !lastGnss.year) return 0;
  
  const first = Date.UTC(firstGnss.year, (firstGnss.month ?? 1) - 1, firstGnss.day ?? 1, 
                         firstGnss.hour ?? 0, firstGnss.min ?? 0, firstGnss.sec ?? 0);
  const last = Date.UTC(lastGnss.year, (lastGnss.month ?? 1) - 1, lastGnss.day ?? 1, 
                        lastGnss.hour ?? 0, lastGnss.min ?? 0, lastGnss.sec ?? 0);
  
  return Math.max(0, (last - first) / 1000);
}
