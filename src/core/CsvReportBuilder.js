// src/core/CsvReportBuilder.js

/**
 * 역할: CSV 보고서를 구성하는 메인 빌더 클래스
 * 
 * 주요 기능:
 * - 종합 정보 섹션 생성 (상단)
 * - 데이터 테이블 섹션 생성 (하단)
 * - 두 섹션을 결합하여 최종 CSV 생성
 * - 다양한 포맷 옵션 지원
 * 
 * CSV 구조:
 * ┌─────────────────────────────┐
 * │  REPORT SUMMARY             │ ← 종합 정보 (key-value)
 * │  - 기본 정보                 │
 * │  - 하드웨어 통계             │
 * │  - 성능 통계                 │
 * │  - 위치 통계                 │
 * │  - 경고 정보                 │
 * ├─────────────────────────────┤
 * │  (빈 줄)                     │
 * ├─────────────────────────────┤
 * │  DATA TABLE                 │ ← 상세 데이터 (표 형식)
 * │  header1, header2, ...      │
 * │  value1, value2, ...        │
 * │  ...                        │
 * └─────────────────────────────┘
 */

import { generateSummary } from "./reportSummary";
import { packetToCsvRow, CSV_HEADER } from "../adapters/packetToCsvRow";
import { csvEscape } from "../utils/csvHelpers";

export class CsvReportBuilder {
  constructor(options = {}) {
    this.options = {
      includeRawJson: false,
      includeSummary: true,
      summaryTitle: "=== INSPECTION REPORT SUMMARY ===",
      dataTitle: "=== DETAILED DATA ===",
      ...options,
    };
  }

  /**
   * 패킷 배열로부터 완전한 CSV 문자열 생성
   * @param {Array} packets - 원본 패킷 객체 배열 (각 항목: { pkt, recvAt })
   * @returns {string} 완전한 CSV 문자열
   */
  build(packets) {
    const sections = [];

    // 1. 종합 정보 섹션
    if (this.options.includeSummary) {
      const rawPackets = packets.map(p => p.pkt);
      const summary = generateSummary(rawPackets);
      sections.push(this.buildSummarySection(summary));
      sections.push(""); // 빈 줄
    }

    // 2. 데이터 테이블 섹션
    sections.push(this.buildDataSection(packets));

    return sections.join("\r\n");
  }

  /**
   * 종합 정보 섹션 생성 (key-value 형식)
   */
  buildSummarySection(summary) {
    const lines = [];

    // 제목
    lines.push(this.options.summaryTitle);
    lines.push("");

    // 기본 정보
    lines.push("## BASIC INFORMATION");
    lines.push(`Total Packets,${summary.meta.total_packets}`);
    lines.push(`First Timestamp,${summary.meta.first_timestamp}`);
    lines.push(`Last Timestamp,${summary.meta.last_timestamp}`);
    lines.push(`Duration (seconds),${summary.meta.duration_seconds}`);
    lines.push("");

    // 하드웨어 건강도
    lines.push("## HARDWARE HEALTH");
    lines.push(`Overall Health,%,${summary.hardware.overall_health_pct}`);
    lines.push(`GNSS Antenna OK Rate,%,${summary.hardware.gnss_antenna_ok_rate}`);
    lines.push(`LTE-V2X Ant1 OK Rate,%,${summary.hardware.ltev2x_ant1_ok_rate}`);
    lines.push(`LTE-V2X Ant2 OK Rate,%,${summary.hardware.ltev2x_ant2_ok_rate}`);
    lines.push(`PPS Sync OK Rate,%,${summary.hardware.pps_sync_ok_rate}`);
    lines.push(`Temperature OK Rate,%,${summary.hardware.temperature_ok_rate}`);
    lines.push(`V2X USB OK Rate,%,${summary.hardware.v2x_usb_ok_rate}`);
    lines.push(`V2X SPI OK Rate,%,${summary.hardware.v2x_spi_ok_rate}`);
    lines.push(`SRAM VBAT OK Rate,%,${summary.hardware.sram_vbat_ok_rate}`);
    lines.push(`LTE-V2X TX Ready Rate,%,${summary.hardware.ltev2x_tx_ready_ok_rate}`);
    lines.push(`Tamper Secure OK Rate,%,${summary.hardware.tamper_secure_ok_rate}`);
    lines.push("");

    // 성능 통계
    lines.push("## PERFORMANCE STATISTICS");
    lines.push(`CPU Usage,Avg/Min/Max,%,${summary.performance.cpu_avg}/${summary.performance.cpu_min}/${summary.performance.cpu_max}`);
    lines.push(`Memory Usage,Avg/Min/Max,%,${summary.performance.mem_avg}/${summary.performance.mem_min}/${summary.performance.mem_max}`);
    lines.push(`Storage Usage,Avg/Min/Max,%,${summary.performance.storage_avg}/${summary.performance.storage_min}/${summary.performance.storage_max}`);
    lines.push(`Temperature,Avg/Min/Max,°C,${summary.performance.temp_avg}/${summary.performance.temp_min}/${summary.performance.temp_max}`);
    lines.push("");

    // 위치 정보 통계
    lines.push("## LOCATION STATISTICS");
    lines.push(`Average Position,Lat/Lon,,${summary.location.lat_avg}/${summary.location.lon_avg}`);
    lines.push(`Average Altitude,m,,${summary.location.alt_avg_m}`);
    lines.push(`Speed,Avg/Max,km/h,${summary.location.speed_avg_kmh}/${summary.location.speed_max_kmh}`);
    lines.push(`Satellites Used,Avg/Min,,${summary.location.sats_avg}/${summary.location.sats_min}`);
    lines.push(`HDOP,Avg/Max,,${summary.location.hdop_avg}/${summary.location.hdop_max}`);
    lines.push("");

    // 인증서 정보
    lines.push("## CERTIFICATE");
    lines.push(`Security Enabled,,${summary.certificate.security_enabled}`);
    lines.push(`Valid Start,Epoch,,${summary.certificate.valid_start}`);
    lines.push(`Valid End,Epoch,,${summary.certificate.valid_end}`);
    lines.push("");

    // 경고 및 이슈
    lines.push("## ALERTS");
    summary.alerts.forEach((alert, idx) => {
      lines.push(`Alert ${idx + 1},,${csvEscape(alert)}`);
    });
    lines.push("");

    return lines.join("\r\n");
  }

  /**
   * 데이터 테이블 섹션 생성 (표 형식)
   */
  buildDataSection(packets) {
    const lines = [];

    // 제목
    lines.push(this.options.dataTitle);
    lines.push("");

    // 헤더
    const header = this.getHeader();
    lines.push(header.map(csvEscape).join(","));

    // 데이터 행들
    for (const { pkt, recvAt } of packets) {
      const row = packetToCsvRow(pkt, recvAt, {
        includeRawJson: this.options.includeRawJson,
      });
      lines.push(header.map(h => csvEscape(row[h] ?? "")).join(","));
    }

    return lines.join("\r\n");
  }

  /**
   * 헤더 컬럼 목록 반환
   */
  getHeader() {
    return CSV_HEADER.filter(h => 
      this.options.includeRawJson || h !== "raw_json"
    );
  }

  /**
   * 시리얼별로 그룹화된 보고서 생성
   * @param {Array} packets - 패킷 배열
   * @returns {Map<string, string>} serial -> CSV 문자열
   */
  buildBySerial(packets) {
    const grouped = new Map();

    for (const item of packets) {
      const serial = item.pkt?.serial_number || "unknown";
      if (!grouped.has(serial)) {
        grouped.set(serial, []);
      }
      grouped.get(serial).push(item);
    }

    const results = new Map();
    for (const [serial, items] of grouped) {
      results.set(serial, this.build(items));
    }

    return results;
  }
}

/**
 * 싱글톤 인스턴스 (간편 사용)
 */
export const csvReportBuilder = new CsvReportBuilder();
