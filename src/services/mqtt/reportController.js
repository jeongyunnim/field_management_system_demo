// src/services/mqtt/reportController.js

/**
 * 역할: CSV 보고서 생성 및 저장
 * 
 * 주요 기능:
 * - 사용자 확인 후 보고서 생성
 * - 플랫폼별 저장 (자동 감지)
 * - 에러 처리 및 폴백
 * 
 * 새로운 CSV 보고서 시스템 통합:
 * - memoryRecorder.toCsv() 사용
 * - exportCsv() 자동 플랫폼 감지
 * - 종합 정보 + 상세 데이터
 */

import { memoryRecorder } from "../../core/MemoryRecorder";
import { exportCsv } from "../../core/exporters";
import { logEvent } from "../../core/logger";

/**
 * 보고서 생성 및 저장 (사용자 확인)
 * @returns {Promise<void>}
 */
export async function generateReport() {
  // 사용자 확인
  const userWantsReport = window.confirm(
    "점검이 완료되었습니다.\n보고서를 생성하시겠습니까?"
  );

  if (!userWantsReport) {
    logEvent({
      level: "INFO",
      source: "REPORT",
      event: "GENERATION_CANCELLED",
      message: "User cancelled report generation",
    });
    return;
  }

  logEvent({
    level: "INFO",
    source: "REPORT",
    event: "GENERATION_START",
    message: "Starting report generation",
  });

  try {
    // 통계 확인
    const stats = memoryRecorder.getStats();
    
    if (stats.packetCount === 0) {
      logEvent({
        level: "WARN",
        source: "REPORT",
        event: "NO_DATA",
        message: "No data to generate report",
      });
      alert("저장할 데이터가 없습니다.");
      return;
    }

    logEvent({
      level: "INFO",
      source: "REPORT",
      event: "DATA_READY",
      message: "Report data ready",
      details: stats,
    });

    // CSV 생성
    const csv = memoryRecorder.toCsv();
    
    // 파일명 생성
    const filename = generateFilename();
    
    // 저장 (플랫폼 자동 감지)
    const success = await exportCsv(csv, filename);

    if (success) {
      logEvent({
        level: "INFO",
        source: "REPORT",
        event: "GENERATION_SUCCESS",
        message: "Report generated successfully",
        details: { filename, dataSize: csv.length, ...stats },
      });
      
      // 성공 알림 (플랫폼별)
      showSuccessMessage(filename);
    } else {
      throw new Error("Export failed");
    }
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "REPORT",
      event: "GENERATION_FAIL",
      message: "Report generation failed",
      details: { error: error.message },
    });
    
    alert(
      "보고서 생성에 실패했습니다.\n" +
      "관리자에게 문의하거나 콘솔 로그를 확인하세요."
    );
  }
}

/**
 * 여러 디바이스의 보고서를 시리얼별로 생성
 * @returns {Promise<void>}
 */
export async function generateReportsBySerial() {
  const userWantsReport = window.confirm(
    "점검이 완료되었습니다.\n디바이스별 보고서를 생성하시겠습니까?"
  );

  if (!userWantsReport) {
    return;
  }

  try {
    const stats = memoryRecorder.getStats();
    
    if (stats.packetCount === 0) {
      alert("저장할 데이터가 없습니다.");
      return;
    }

    logEvent({
      level: "INFO",
      source: "REPORT",
      event: "MULTI_GENERATION_START",
      message: "Starting multi-device report generation",
      details: { serialNumbers: stats.serialNumbers },
    });

    // 시리얼별 CSV 생성
    const csvBySerial = memoryRecorder.toCsvBySerial();
    
    if (csvBySerial.size === 1) {
      // 디바이스가 1개면 일반 저장
      const [serial, csv] = [...csvBySerial][0];
      const filename = `${serial}_${generateFilename()}`;
      await exportCsv(csv, filename);
    } else {
      // 여러 디바이스면 각각 저장 또는 ZIP
      for (const [serial, csv] of csvBySerial) {
        const filename = `${serial}_${generateFilename()}`;
        await exportCsv(csv, filename);
      }
    }

    logEvent({
      level: "INFO",
      source: "REPORT",
      event: "MULTI_GENERATION_SUCCESS",
      message: "Multi-device reports generated",
      details: { count: csvBySerial.size },
    });

    alert(`${csvBySerial.size}개의 보고서가 생성되었습니다.`);
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "REPORT",
      event: "MULTI_GENERATION_FAIL",
      message: "Multi-device report generation failed",
      details: { error: error.message },
    });
    
    alert("보고서 생성에 실패했습니다.");
  }
}

/**
 * 파일명 생성
 * @returns {string} 타임스탬프 포함 파일명
 */
function generateFilename() {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .slice(0, 19);
  
  return `RSE_Inspection_${timestamp}.csv`;
}

/**
 * 성공 메시지 표시 (플랫폼별)
 * @param {string} filename - 파일명
 */
function showSuccessMessage(filename) {
  // 플랫폼 감지 (간단한 방법)
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  
  if (isAndroid) {
    alert(
      "보고서가 생성되었습니다.\n" +
      "공유 앱을 선택하여 이메일, 드라이브 등으로 전송하세요.\n\n" +
      `파일: ${filename}`
    );
  } else if (isIOS) {
    alert(
      "보고서가 저장되었습니다.\n" +
      "파일 앱 > Documents 폴더에서 확인하세요.\n\n" +
      `파일: ${filename}`
    );
  } else {
    // 웹 브라우저
    alert(
      "보고서가 다운로드되었습니다.\n" +
      "다운로드 폴더를 확인하세요.\n\n" +
      `파일: ${filename}`
    );
  }
}
