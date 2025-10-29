// src/core/exporters.js

/**
 * 역할: CSV 파일을 다양한 플랫폼에 저장/다운로드
 * 
 * 지원 플랫폼:
 * - 웹 브라우저 (Blob 다운로드)
 * - Android (Capacitor Filesystem) - Download 폴더 우선
 * - iOS (Capacitor Filesystem)
 * - Electron (Native File System)
 * 
 * 주요 기능:
 * - 플랫폼 자동 감지
 * - 파일명 자동 생성 (타임스탬프 포함)
 * - 안드로이드 Download 폴더 저장
 * - 안드로이드 공유 기능
 * - 에러 처리 및 폴백
 * 
 * 수정 사항 (2025-10-28):
 * - Vite 빌드 에러 방지 (@vite-ignore)
 * - Android Download 폴더 우선 저장
 * - 상세한 에러 로깅
 * - Capacitor 플러그인 에러 처리 강화
 */

import { logEvent } from "./logger";

/**
 * 플랫폼별 최적 저장 방법 선택 및 실행
 * @param {string} csvContent - CSV 문자열
 * @param {string} filename - 파일명 (기본값: 자동 생성)
 * @returns {Promise<boolean>} 성공 여부
 */
export async function exportCsv(csvContent, filename = null) {
  // 파일명 자동 생성
  if (!filename) {
    filename = generateFilename();
  }

  console.log('[EXPORT] Starting CSV export...');
  console.log('[EXPORT] Filename:', filename);
  console.log('[EXPORT] Size:', (csvContent.length / 1024).toFixed(2), 'KB');

  try {
    const platform = await detectPlatform();
    
    console.log('[EXPORT] Detected platform:', platform);
    
    logEvent({
      level: "INFO",
      source: "EXPORT",
      event: "EXPORT_START",
      message: `Exporting CSV on ${platform}`,
      details: { platform, filename, size: csvContent.length },
    });

    let success = false;

    switch (platform) {
      case "android":
      case "ios":
        success = await saveCsvOnMobile(csvContent, filename);
        break;
      
      case "electron":
        success = await saveCsvOnElectron(csvContent, filename);
        break;
      
      case "web":
      default:
        success = downloadCsvInBrowser(csvContent, filename);
        break;
    }

    if (success) {
      console.log('[EXPORT] ✅ Export successful!');
      logEvent({
        level: "INFO",
        source: "EXPORT",
        event: "EXPORT_SUCCESS",
        message: `CSV exported successfully`,
        details: { platform, filename },
      });
    } else {
      console.error('[EXPORT] ❌ Export failed');
    }

    return success;
  } catch (error) {
    console.error('[EXPORT] ❌ Export error:', error);
    
    logEvent({
      level: "ERROR",
      source: "EXPORT",
      event: "EXPORT_FAIL",
      message: `Failed to export CSV: ${error.message}`,
      details: { error: error.message, filename, stack: error.stack },
    });
    
    // 폴백: 브라우저 다운로드
    console.log('[EXPORT] Attempting fallback to browser download...');
    return downloadCsvInBrowser(csvContent, filename);
  }
}

/**
 * 웹 브라우저에서 CSV 다운로드
 * @param {string} csvContent - CSV 문자열
 * @param {string} filename - 파일명
 * @returns {boolean} 성공 여부
 */
export function downloadCsvInBrowser(csvContent, filename) {
  try {
    console.log('[WEB] Starting browser download...');
    
    // BOM 추가 (Excel에서 UTF-8 인식)
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { 
      type: "text/csv;charset=utf-8" 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    
    // DOM에 추가 후 클릭
    document.body.appendChild(a);
    a.click();
    
    // 정리
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    
    console.log('[WEB] ✅ Browser download triggered');
    return true;
  } catch (error) {
    console.error("[WEB] ❌ Browser download failed:", error);
    return false;
  }
}

/**
 * 모바일 (Android/iOS)에서 CSV 저장
 * @param {string} csvContent - CSV 문자열
 * @param {string} filename - 파일명
 * @returns {Promise<boolean>} 성공 여부
 */
export async function saveCsvOnMobile(csvContent, filename) {
  console.log('[MOBILE] Starting mobile save...');
  
  try {
    // Capacitor 모듈 동적 import - Vite 빌드 에러 방지
    console.log('[MOBILE] Loading Filesystem plugin...');
    const { Filesystem, Directory, Encoding } = await import(
      /* @vite-ignore */
      "@capacitor/filesystem"
    );

    console.log('[MOBILE] ✅ Filesystem plugin loaded');

    // BOM 추가 (Excel에서 UTF-8 인식)
    const BOM = "\uFEFF";
    
    const platform = await detectPlatform();
    console.log('[MOBILE] Platform confirmed:', platform);
    console.log('[MOBILE] Attempting to save:', filename);
    
    let result;
    let savedLocation = 'Documents';

    // Android: Download 폴더 먼저 시도 (사용자가 쉽게 찾을 수 있음)
    if (platform === "android") {
      try {
        console.log('[ANDROID] Attempting ExternalStorage (Download folder)...');
        
        result = await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: BOM + csvContent,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        
        savedLocation = 'Download';
        console.log('[ANDROID] ✅ Saved to Download folder');
        console.log('[ANDROID] URI:', result.uri);
        
        // 사용자에게 알림
        alert(`파일이 저장되었습니다!\n\n위치: Download/${filename}`);
        
      } catch (externalError) {
        console.warn('[ANDROID] ⚠️ ExternalStorage failed:', externalError.message);
        console.log('[ANDROID] Fallback to Documents folder...');
        
        // Fallback: Documents 디렉토리
        try {
          result = await Filesystem.writeFile({
            path: filename,
            data: BOM + csvContent,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          
          savedLocation = 'Documents';
          console.log('[ANDROID] ✅ Saved to Documents folder');
          console.log('[ANDROID] URI:', result.uri);
          
          // Documents 저장 시 공유 다이얼로그
          await shareFileOnAndroid(filename, result.uri);
          
        } catch (documentsError) {
          console.error('[ANDROID] ❌ Documents also failed:', documentsError);
          throw documentsError;
        }
      }
    } else {
      // iOS: Documents만 사용
      console.log('[iOS] Saving to Documents folder...');
      
      result = await Filesystem.writeFile({
        path: filename,
        data: BOM + csvContent,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      
      console.log('[iOS] ✅ Saved to Documents');
      console.log('[iOS] URI:', result.uri);
      
      // iOS는 공유 다이얼로그 표시
      await shareFileOnAndroid(filename, result.uri);
    }

    logEvent({
      level: "INFO",
      source: "EXPORT",
      event: "FILE_SAVED",
      message: `File saved to ${savedLocation}`,
      details: { filename, uri: result.uri, location: savedLocation },
    });

    return true;
    
  } catch (error) {
    console.error("[MOBILE] ❌ Mobile save failed:", error);
    console.error("[MOBILE] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // 에러 종류별 처리
    if (error.message && error.message.includes('not implemented')) {
      console.error('[MOBILE] 🚨 Capacitor plugin not installed or synced!');
      console.error('[MOBILE] Fix:');
      console.error('[MOBILE] 1. npm install @capacitor/filesystem @capacitor/share');
      console.error('[MOBILE] 2. npx cap sync android');
      console.error('[MOBILE] 3. Rebuild the app');
      
      alert('❌ 파일 저장 실패!\n\nCapacitor 플러그인이 설치되지 않았습니다.\n\n해결 방법:\n1. npm install @capacitor/filesystem\n2. npx cap sync android\n3. 앱 재빌드');
    }
    
    logEvent({
      level: "ERROR",
      source: "EXPORT",
      event: "MOBILE_SAVE_FAIL",
      message: `Mobile save failed: ${error.message}`,
      details: { filename, error: error.message, stack: error.stack },
    });
    
    return false;
  }
}

/**
 * 안드로이드에서 파일 공유
 * @param {string} filename - 파일명
 * @param {string} uri - 파일 URI
 */
async function shareFileOnAndroid(filename, uri) {
  try {
    console.log('[SHARE] Attempting to share file...');
    
    const { Share } = await import(
      /* @vite-ignore */
      "@capacitor/share"
    );
    
    await Share.share({
      title: "RSE 점검 보고서",
      text: `CSV 보고서: ${filename}`,
      url: uri,
      dialogTitle: "보고서 저장 위치 선택",
    });
    
    console.log('[SHARE] ✅ Share dialog completed');
  } catch (error) {
    // 공유 실패는 치명적이지 않음 (파일은 이미 저장됨)
    console.warn("[SHARE] ⚠️ Share failed (non-fatal):", error.message);
  }
}

/**
 * Electron에서 CSV 저장
 * @param {string} csvContent - CSV 문자열
 * @param {string} filename - 파일명
 * @returns {Promise<boolean>} 성공 여부
 */
export async function saveCsvOnElectron(csvContent, filename) {
  try {
    console.log('[ELECTRON] Starting Electron save...');
    
    if (!window.electronAPI?.saveFile) {
      throw new Error("Electron API not available");
    }

    // 사용자에게 저장 위치 선택 요청
    const filePath = await window.electronAPI.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (!filePath) {
      // 사용자가 취소함
      console.log('[ELECTRON] User cancelled');
      return false;
    }

    // BOM 추가
    const BOM = "\uFEFF";
    await window.electronAPI.saveFile(filePath, BOM + csvContent);

    console.log('[ELECTRON] ✅ Saved successfully');
    return true;
  } catch (error) {
    console.error("[ELECTRON] ❌ Save failed:", error);
    return false;
  }
}

/**
 * 플랫폼 감지
 * @returns {Promise<string>} "web" | "android" | "ios" | "electron"
 */
async function detectPlatform() {
  // Electron 우선 체크
  if (typeof window.electronAPI !== "undefined") {
    return "electron";
  }

  // Capacitor 체크
  try {
    const { Capacitor } = await import(
      /* @vite-ignore */
      "@capacitor/core"
    );
    
    if (Capacitor?.isNativePlatform?.()) {
      const platform = Capacitor.getPlatform();
      console.log('[PLATFORM] Capacitor detected:', platform);
      return platform;
    }
  } catch (error) {
    console.log('[PLATFORM] Capacitor not available:', error.message);
  }

  console.log('[PLATFORM] Defaulting to web');
  return "web";
}

/**
 * 파일명 자동 생성 (타임스탬프 포함)
 * @returns {string} 파일명
 */
function generateFilename() {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .slice(0, 19);
  
  return `RSE_Report_${timestamp}.csv`;
}

/**
 * 여러 시리얼의 보고서를 ZIP으로 묶어서 저장
 * @param {Map<string, string>} csvMap - serial -> CSV 문자열
 * @returns {Promise<boolean>} 성공 여부
 */
export async function exportMultipleCsvAsZip(csvMap) {
  try {
    console.log('[ZIP] Creating ZIP archive...');
    
    // JSZip 사용 (필요시 설치: npm install jszip)
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // 각 시리얼별 CSV 추가
    for (const [serial, csvContent] of csvMap) {
      const filename = `${serial}_${generateFilename()}`;
      zip.file(filename, "\uFEFF" + csvContent);
      console.log('[ZIP] Added:', filename);
    }

    // ZIP 생성
    const zipBlob = await zip.generateAsync({ type: "blob" });
    console.log('[ZIP] ZIP created, size:', (zipBlob.size / 1024).toFixed(2), 'KB');
    
    // 다운로드
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RSE_Reports_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    console.log('[ZIP] ✅ ZIP download triggered');
    return true;
  } catch (error) {
    console.error("[ZIP] ❌ ZIP export failed:", error);
    return false;
  }
}

/**
 * 디버깅용 - 플랫폼 및 Capacitor 정보 확인
 */
export async function debugCapacitorInfo() {
  console.log('\n========================================');
  console.log('🔍 CAPACITOR DEBUG INFO');
  console.log('========================================');
  
  try {
    const { Capacitor } = await import(
      /* @vite-ignore */
      "@capacitor/core"
    );
    
    console.log('✅ Capacitor Core: Available');
    console.log('  - Version:', Capacitor.version || 'unknown');
    console.log('  - Platform:', Capacitor.getPlatform());
    console.log('  - Is Native:', Capacitor.isNativePlatform());
    
    // Filesystem 체크
    try {
      const { Filesystem } = await import(
        /* @vite-ignore */
        "@capacitor/filesystem"
      );
      console.log('✅ Filesystem Plugin: Available');
    } catch (err) {
      console.error('❌ Filesystem Plugin: NOT Available');
      console.error('   Error:', err.message);
    }
    
    // Share 체크
    try {
      const { Share } = await import(
        /* @vite-ignore */
        "@capacitor/share"
      );
      console.log('✅ Share Plugin: Available');
    } catch (err) {
      console.error('❌ Share Plugin: NOT Available');
      console.error('   Error:', err.message);
    }
    
    // Device 정보 (있다면)
    try {
      const { Device } = await import(
        /* @vite-ignore */"@capacitor/device"
      );
      const info = await Device.getInfo();
      console.log('✅ Device Info:');
      console.log('  - Model:', info.model);
      console.log('  - Platform:', info.platform);
      console.log('  - OS Version:', info.osVersion);
      console.log('  - Manufacturer:', info.manufacturer);
    } catch (err) {
      console.log('ℹ️ Device plugin not available (optional)');
    }
    
  } catch (error) {
    console.error('❌ Capacitor Core: NOT Available');
    console.error('   Error:', error.message);
  }
  
  console.log('========================================\n');
}