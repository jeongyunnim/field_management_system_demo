// src/utils/parseRse.js

/**
 * RSE 원본 패킷을 정규화된 형식으로 파싱
 * ⭐ 2025-10-27: 실제 패킷 구조에 맞게 작성
 * 
 * @param {object} raw - 원본 MQTT 패킷
 * @returns {object} 정규화된 데이터
 */
export function parseRsePacket(raw) {
  if (!raw) return null;

  try {
    return {
      // 기본 정보
      serial: raw.serial_number,
      hardwareVersion: raw.hardware_version,
      osVersion: raw.os_version,
      firmwareVersion: raw.firmware_version,

      cpuTotalPct: raw.cpu_usage_status?.cpu_usage_total_percent,
      cpuCores: raw.cpu_usage_status?.cpu_usage_core_percent,
      
      memUsedPct: raw.memory_usage_status?.memory_usage_percent,
      memTotalMb: raw.memory_usage_status?.memory_usage_total_mb,
      memUsedMb: raw.memory_usage_status?.memory_usage_used_mb,
      
      diskUsedPct: raw.storage_usage_status?.storage_usage_percent,
      diskTotalGb: raw.storage_usage_status?.storage_usage_total_gb,
      diskUsedGb: raw.storage_usage_status?.storage_usage_used_gb,
      
      temperatureC: raw.temperature_status?.temperature_celsius,
      temperatureOk: raw.temperature_status?.temperature_status,

      // GNSS 데이터 (좌표는 1e7 스케일 적용)
      gnss: parseGnssData(raw.gnss_data),

      // 안테나 상태
      antennas: {
        gnss: raw.gnss_antenna_status,
        ltev2x1: raw.ltev2x_antenna1_status,
        ltev2x2: raw.ltev2x_antenna2_status,
      },

      // 하드웨어 상태
      hardware: {
        v2xUsb: raw.v2x_usb_status,
        v2xSpi: raw.v2x_spi_status,
        sramVbat: raw.sram_vbat_status,
        secton1pps: raw.secton_1pps_status,
        tamperSecure: raw.tamper_secure_status,
      },

      // V2X 상태
      ltev2xTxReady: raw.ltev2x_tx_ready_status,

      // 인증서 정보
      certificate: raw.certificate ? {
        securityEnabled: raw.certificate.ltev2x_cert_status_security_enable,
        validStart: raw.certificate.ltev2x_cert_valid_start,
        validEnd: raw.certificate.ltev2x_cert_valid_end,
      } : null,

      // 네트워크 인터페이스
      interfaces: parseInterfaces(raw.interface_info),
    };
  } catch (error) {
    console.error('[parseRsePacket] Parse error:', error);
    return null;
  }
}

/**
 * GNSS 데이터 파싱
 * 좌표는 1e7 스케일로 인코딩되어 있음
 */
function parseGnssData(gnss) {
  if (!gnss) return null;

  return {
    mode: gnss.mode,
    status: gnss.status,
    
    // ⭐ 좌표 변환 (1e7로 나눔)
    lat: gnss.latitude != null ? gnss.latitude / 1e7 : null,
    lon: gnss.longitude != null ? gnss.longitude / 1e7 : null,
    
    altHAE: gnss.altHAE,
    altMSL: gnss.altMSL,
    speed: gnss.speed,
    
    // ⭐ 방향 변환 (1e2로 나눔, 도 단위)
    heading_deg: gnss.heading != null ? gnss.heading / 100 : null,
    
    // 정확도 정보
    semiMajor: gnss.semiMajor,
    semiMinor: gnss.semiMinor,
    orientation: gnss.orientation,
    
    // 위성 정보
    numSatellites: gnss.numSatellites,
    numUsedSatellites: gnss.numUsedSatellites,
    
    // DOP 값
    pdop: parseFloat(gnss.pdop) || null,
    hdop: parseFloat(gnss.hdop) || null,
    vdop: parseFloat(gnss.vdop) || null,
    
    // 정확도 (미터)
    hacc: parseFloat(gnss.hacc) || null,
    vacc: parseFloat(gnss.vacc) || null,
    pacc: parseFloat(gnss.pacc) || null,
    
    // 타임스탬프
    timestamp: gnss.year && gnss.month && gnss.day ? {
      year: gnss.year,
      month: gnss.month,
      day: gnss.day,
      hour: gnss.hour,
      min: gnss.min,
      sec: gnss.sec,
      nanosec: gnss.nanosec,
    } : null,
  };
}

/**
 * 네트워크 인터페이스 파싱
 */
function parseInterfaces(interfaceInfo) {
  if (!interfaceInfo?.interface_array) return [];

  return interfaceInfo.interface_array.map(iface => ({
    name: iface.name,
    ipv4: iface.ip_addr,
    addresses: iface.addr_array?.map(addr => ({
      addr: addr.addr,
      family: addr.family === 4 ? 'IPv4' : 'IPv6',
      prefixLen: addr.prefix_len,
    })) || [],
  }));
}

/**
 * V2X 메시지 통계 파싱
 * (패킷에 없는 경우 기본값 반환)
 */
export function parseV2xStats(raw) {
  return {
    rxTotal: raw?.rse_status?.ltev2x_rx_total_cnt ?? 0,
    txTotal: raw?.rse_status?.ltev2x_tx_total_cnt ?? 0,
    txReady: raw?.ltev2x_tx_ready_status ?? false,
  };
}

/**
 * RSE 상태 요약 생성
 */
export function getRseStatusSummary(raw) {
  const parsed = parseRsePacket(raw);
  if (!parsed) return null;

  return {
    serial: parsed.serial,
    online: parsed.ltev2xTxReady,
    hasGnssFix: parsed.gnss?.mode === 3,
    temperature: parsed.temperatureC,
    cpu: parsed.cpuTotalPct,
    memory: parsed.memUsedPct,
    disk: parsed.diskUsedPct,
    coordinates: parsed.gnss?.lat && parsed.gnss?.lon ? {
      lat: parsed.gnss.lat,
      lon: parsed.gnss.lon,
    } : null,
  };
}