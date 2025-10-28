// src/core/MemoryRecorder.js

/**
 * 역할: 실시간으로 패킷을 메모리에 저장하고 CSV 보고서로 변환
 * 
 * 주요 기능:
 * - 패킷 스트림을 메모리에 저장 (순환 버퍼)
 * - 저장된 패킷을 CSV 보고서로 변환
 * - 시리얼별 그룹화 지원
 * - 메모리 제한 관리 (maxRows)
 * 
 * 사용 예시:
 * ```js
 * memoryRecorder.start();
 * memoryRecorder.add(packet1);
 * memoryRecorder.add(packet2);
 * memoryRecorder.stop();
 * const csv = memoryRecorder.toCsv();
 * ```
 */

import { CsvReportBuilder } from "./CsvReportBuilder";

export class MemoryRecorder {
  constructor(options = {}) {
    this.options = {
      includeRawJson: false,
      includeSummary: true,
      maxRows: 100_000,
      ...options,
    };
    
    this.rows = []; // 저장: [{ pkt, recvAt }, ...]
    this.startedAt = null;
    this.endedAt = null;
    
    // CSV 빌더 인스턴스
    this.csvBuilder = new CsvReportBuilder({
      includeRawJson: this.options.includeRawJson,
      includeSummary: this.options.includeSummary,
    });
  }

  /**
   * 기록 시작
   */
  start() {
    this.rows = [];
    this.startedAt = Date.now();
    this.endedAt = null;
  }

  /**
   * 패킷 추가 (순환 버퍼)
   * @param {Object} packetObj - 원본 패킷 객체
   * @param {number} recvAtMs - 수신 시각 (기본값: 현재 시각)
   */
  add(packetObj, recvAtMs = Date.now()) {
    if (!this.startedAt) return; // 아직 시작 안 함
    if (!packetObj) return; // 빈 패킷 무시
    
    // 메모리 제한 (순환 버퍼)
    if (this.rows.length >= this.options.maxRows) {
      this.rows.shift(); // 가장 오래된 항목 제거
    }
    
    // 저장
    this.rows.push({ pkt: packetObj, recvAt: recvAtMs });
  }

  /**
   * 기록 종료
   */
  stop() {
    this.endedAt = Date.now();
  }

  /**
   * 전체 CSV 보고서 생성
   * @returns {string} CSV 문자열
   */
  toCsv() {
    return this.csvBuilder.build(this.rows);
  }

  /**
   * 시리얼별로 그룹화된 CSV 보고서 생성
   * @returns {Map<string, string>} serial -> CSV 문자열
   */
  toCsvBySerial() {
    return this.csvBuilder.buildBySerial(this.rows);
  }

  /**
   * 저장된 패킷 개수
   */
  getPacketCount() {
    return this.rows.length;
  }

  /**
   * 기록 진행 중인지 확인
   */
  isRecording() {
    return this.startedAt !== null && this.endedAt === null;
  }

  /**
   * 기록 시간 (초)
   */
  getRecordingDuration() {
    if (!this.startedAt) return 0;
    
    const endTime = this.endedAt || Date.now();
    return (endTime - this.startedAt) / 1000;
  }

  /**
   * 시리얼 번호 목록
   */
  getSerialNumbers() {
    const serials = new Set();
    for (const { pkt } of this.rows) {
      const serial = pkt?.serial_number || "unknown";
      serials.add(serial);
    }
    return Array.from(serials);
  }

  /**
   * 통계 정보
   */
  getStats() {
    return {
      packetCount: this.rows.length,
      serialNumbers: this.getSerialNumbers(),
      recordingDuration: this.getRecordingDuration(),
      isRecording: this.isRecording(),
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      memoryUsageMB: (JSON.stringify(this.rows).length / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * 메모리 초기화
   */
  clear() {
    this.rows = [];
    this.startedAt = null;
    this.endedAt = null;
  }
}

/**
 * 싱글톤 인스턴스 (전역 사용)
 */
export const memoryRecorder = new MemoryRecorder({
  includeRawJson: false,
  includeSummary: true,
  maxRows: 100_000,
});
