// src/adapters/packetToCsvRow.js

/**
 * 역할: 원본 패킷 객체를 CSV 행 객체로 변환
 * 
 * 주요 기능:
 * - 복잡한 중첩 구조를 평탄화
 * - 단위 변환 (cm -> m, cm/s -> km/h 등)
 * - 안전한 타입 변환 (NaN, null 처리)
 * - 선택적 raw JSON 포함
 * 
 * 변환 예시:
 * {
 *   gnss_data: { latitude: 372797152, ... }  
 * }
 * ↓
 * {
 *   lat: "37.2797152",
 *   lon: "127.1194165",
 *   ...
 * }
 */

import { toIso, fromUtcPartsMs, N, B } from "../utils/csvHelpers";
import { epochSecToDateAuto } from "../utils/epochSecToDateAuto";

/**
 * CSV 헤더 정의 (컬럼 순서)
 */
export const CSV_HEADER = [
  // 기본 정보
  "serial",
  "recv_at",
  "device_ts",
  "hw_version",
  "os_version",
  "fw_version",
  
  // 하드웨어 체크 (boolean)
  "gnss_antenna_ok",
  "ltev2x_ant1_ok",
  "ltev2x_ant2_ok",
  "pps_sync",
  "temp_ok",
  "temp_c",
  "v2x_usb_ok",
  "v2x_spi_ok",
  "sram_vbat_ok",
  "tamper_secure",
  "ltev2x_tx_ready",
  
  // CPU
  "cpu_total_pct",
  "cpu_core_0_pct",
  "cpu_core_1_pct",
  "cpu_core_2_pct",
  "cpu_core_3_pct",
  
  // 메모리
  "mem_used_pct",
  "mem_total_mb",
  "mem_used_mb",
  
  // 스토리지
  "storage_used_pct",
  "storage_total_gb",
  "storage_used_gb",
  
  // 인증서
  "cert_security_enable",
  "cert_valid_start",
  "cert_valid_end",
  
  // 위치 (GNSS)
  "lat",
  "lon",
  "alt_m",
  "speed_kmh",
  "heading_deg",
  
  // GNSS 정밀도
  "pdop",
  "hdop",
  "vdop",
  "hacc_m",
  "vacc_m",
  "pacc",
  
  // GNSS 위성
  "num_sats",
  "num_sats_used",
  
  // 네트워크
  "primary_ip",
  "eth0_ip",
  "ltev2x0_ip",
  
  // 원본 JSON (옵션)
  "raw_json",
];

/**
 * 패킷 객체를 CSV 행 객체로 변환
 * @param {Object} pkt - 원본 패킷 객체
 * @param {number} recvAtMs - 수신 시각 (밀리초)
 * @param {Object} options - 옵션 { includeRawJson }
 * @returns {Object} CSV 행 객체 (키: 헤더명, 값: 문자열)
 */
export function packetToCsvRow(pkt, recvAtMs = Date.now(), options = {}) {
  const { includeRawJson = false } = options;
  
  // 하위 객체 추출
  const gnss = pkt?.gnss_data ?? {};
  const mem = pkt?.memory_usage_status ?? {};
  const stor = pkt?.storage_usage_status ?? {};
  const cpu = pkt?.cpu_usage_status ?? {};
  const cert = pkt?.certificate ?? {};
  const temp = pkt?.temperature_status ?? {};
  
  // 기본 정보
  const basic = extractBasicInfo(pkt, gnss, recvAtMs);
  
  // 하드웨어 상태
  const hardware = extractHardwareStatus(pkt, temp);
  
  // 성능 정보
  const performance = extractPerformanceInfo(cpu, mem, stor);
  
  // 인증서 정보
  const certificate = extractCertificateInfo(cert);
  
  // 위치 정보
  const location = extractLocationInfo(gnss);
  
  // 네트워크 정보
  const network = extractNetworkInfo(pkt);
  
  // 모든 정보 결합
  const row = {
    ...basic,
    ...hardware,
    ...performance,
    ...certificate,
    ...location,
    ...network,
  };
  
  // 원본 JSON 추가 (옵션)
  if (includeRawJson) {
    row.raw_json = JSON.stringify(pkt);
  }
  
  return row;
}

/**
 * 기본 정보 추출 (시리얼, 버전, 타임스탬프)
 */
function extractBasicInfo(pkt, gnss, recvAtMs) {
  // 디바이스 타임스탬프 (GNSS 시간)
  const deviceTsMs = fromUtcPartsMs({
    y: gnss.year,
    m: gnss.month,
    d: gnss.day,
    hh: gnss.hour,
    mm: gnss.min,
    ss: gnss.sec,
  });
  
  return {
    serial: pkt?.serial_number ?? "",
    recv_at: toIso(recvAtMs),
    device_ts: Number.isFinite(deviceTsMs) ? toIso(deviceTsMs) : "",
    hw_version: pkt?.hardware_version ?? "",
    os_version: pkt?.os_version ?? "",
    fw_version: pkt?.firmware_version ?? "",
  };
}

/**
 * 하드웨어 상태 추출 (안테나, 센서 등)
 */
function extractHardwareStatus(pkt, temp) {
  return {
    gnss_antenna_ok: B(pkt.gnss_antenna_status),
    ltev2x_ant1_ok: B(pkt.ltev2x_antenna1_status),
    ltev2x_ant2_ok: B(pkt.ltev2x_antenna2_status),
    pps_sync: B(pkt.secton_1pps_status),
    temp_ok: B(temp?.temperature_status),
    temp_c: N(temp?.temperature_celsius, 1),
    v2x_usb_ok: B(pkt.v2x_usb_status),
    v2x_spi_ok: B(pkt.v2x_spi_status),
    sram_vbat_ok: B(pkt.sram_vbat_status),
    tamper_secure: B(pkt.tamper_secure_status),
    ltev2x_tx_ready: B(pkt.ltev2x_tx_ready_status),
  };
}

/**
 * 성능 정보 추출 (CPU, 메모리, 스토리지)
 */
function extractPerformanceInfo(cpu, mem, stor) {
  // CPU 코어별 사용률
  const cores = Array.isArray(cpu?.cpu_usage_core_percent) 
    ? cpu.cpu_usage_core_percent 
    : [];
  
  return {
    cpu_total_pct: N(cpu?.cpu_usage_total_percent, 2),
    cpu_core_0_pct: N(cores[0], 2),
    cpu_core_1_pct: N(cores[1], 2),
    cpu_core_2_pct: N(cores[2], 2),
    cpu_core_3_pct: N(cores[3], 2),
    
    mem_used_pct: N(mem?.memory_usage_percent, 2),
    mem_total_mb: N(mem?.memory_usage_total_mb),
    mem_used_mb: N(mem?.memory_usage_used_mb),
    
    storage_used_pct: N(stor?.storage_usage_percent, 2),
    storage_total_gb: N(stor?.storage_usage_total_gb, 3),
    storage_used_gb: N(stor?.storage_usage_used_gb, 3),
  };
}

/**
 * 인증서 정보 추출
 */
function extractCertificateInfo(cert) {
  const certStartMs = epochSecToDateAuto(cert?.ltev2x_cert_valid_start);
  const certEndMs = epochSecToDateAuto(cert?.ltev2x_cert_valid_end);
  
  return {
    cert_security_enable: B(cert?.ltev2x_cert_status_security_enable),
    cert_valid_start: Number.isFinite(certStartMs) ? toIso(certStartMs) : "",
    cert_valid_end: Number.isFinite(certEndMs) ? toIso(certEndMs) : "",
  };
}

/**
 * 위치 정보 추출 (GNSS)
 */
function extractLocationInfo(gnss) {
  // 위경도 변환 (1e-7도 단위 -> 도)
  const lat = Number.isFinite(gnss.latitude) 
    ? gnss.latitude / 1e7 
    : NaN;
  const lon = Number.isFinite(gnss.longitude) 
    ? gnss.longitude / 1e7 
    : NaN;
  
  // 고도 변환 (cm -> m)
  const alt_m = Number.isFinite(gnss.altMSL) 
    ? gnss.altMSL / 100 
    : NaN;
  
  // 속도 변환 (cm/s -> km/h)
  const speedKmh = Number.isFinite(gnss.speed) 
    ? gnss.speed * 0.036 
    : NaN;
  
  // 방향 변환 (1e-2도 -> 도)
  const headingDeg = Number.isFinite(gnss.heading) 
    ? gnss.heading / 100 
    : NaN;
  
  return {
    lat: N(lat, 7),
    lon: N(lon, 7),
    alt_m: N(alt_m, 2),
    speed_kmh: N(speedKmh, 2),
    heading_deg: N(headingDeg, 2),
    
    pdop: N(gnss?.pdop, 3),
    hdop: N(gnss?.hdop, 3),
    vdop: N(gnss?.vdop, 3),
    hacc_m: N(gnss?.hacc, 3),
    vacc_m: N(gnss?.vacc, 3),
    pacc: N(gnss?.pacc, 3),
    
    num_sats: N(gnss?.numSatellites),
    num_sats_used: N(gnss?.numUsedSatellites),
  };
}

/**
 * 네트워크 정보 추출
 */
function extractNetworkInfo(pkt) {
  let primary_ip = "";
  let eth0_ip = "";
  let ltev2x0_ip = "";
  
  const interfaces = pkt?.interface_info?.interface_array ?? [];
  
  for (const iface of interfaces) {
    // primary IP: 첫 번째 non-localhost IP
    if (!primary_ip && iface.ip_addr && iface.ip_addr !== "127.0.0.1") {
      primary_ip = iface.ip_addr;
    }
    
    // 특정 인터페이스 IP
    if (iface.name === "eth0") {
      eth0_ip = iface.ip_addr ?? "";
    }
    if (iface.name === "ltev2x0") {
      ltev2x0_ip = iface.ip_addr ?? "";
    }
  }
  
  return { primary_ip, eth0_ip, ltev2x0_ip };
}
