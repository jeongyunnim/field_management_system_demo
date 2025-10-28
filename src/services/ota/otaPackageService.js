// src/services/ota/otaPackageService.js
import JSZip from "jszip";
import {
  savePackage,
  saveIndexMetadata,
  getIndexMetadata,
  getAllPackages,
  checkPackageNeedsUpdate,
  clearAllPackages,
} from "../../dbms/otaDb";
import { logEvent } from "../../core/logger";

/**
 * ZIP 파일에서 OTA 패키지 업로드
 */
export async function uploadOtaPackageZip(zipFile) {
  try {
    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "UPLOAD_START",
      message: `Uploading OTA package: ${zipFile.name}`,
      details: { size: zipFile.size },
    });

    // ZIP 파일 읽기
    const zip = await JSZip.loadAsync(zipFile);

    // index.json 찾기
    const indexFile = zip.file("index.json");
    if (!indexFile) {
      throw new Error("index.json not found in ZIP file");
    }

    // index.json 파싱
    const indexContent = await indexFile.async("string");
    const indexData = JSON.parse(indexContent);

    if (!indexData.services || !Array.isArray(indexData.services)) {
      throw new Error("Invalid index.json format");
    }

    // 기존 index 가져오기
    const existingIndex = await getIndexMetadata();
    const existingPackages = await getAllPackages();
    const existingVersionMap = new Map(
      existingPackages.map((p) => [p.sw_id, p.version])
    );

    let uploadedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // 각 서비스 처리
    for (const service of indexData.services) {
      const { sw_id, version, sw_path, sw_md5 } = service;

      // 버전 비교
      const needsUpdate = await checkPackageNeedsUpdate(sw_id, version);

      if (!needsUpdate) {
        logEvent({
          level: "INFO",
          source: "OTA_PACKAGE",
          event: "PACKAGE_SKIP",
          message: `Skipping ${sw_id} v${version} (already up to date)`,
        });
        skippedCount++;
        continue;
      }

      // 파일 경로 정규화 (앞의 / 제거)
      const normalizedPath = sw_path.startsWith("/")
        ? sw_path.substring(1)
        : sw_path;

      // ZIP에서 파일 찾기
      const packageFile = zip.file(normalizedPath);
      if (!packageFile) {
        logEvent({
          level: "WARN",
          source: "OTA_PACKAGE",
          event: "FILE_NOT_FOUND",
          message: `File not found in ZIP: ${normalizedPath}`,
          details: { sw_id, version },
        });
        continue;
      }

      // 파일을 Base64로 읽기
      const arrayBuffer = await packageFile.async("arraybuffer");
      const base64Data = arrayBufferToBase64(arrayBuffer);

      // DB에 저장
      await savePackage({
        sw_id,
        version,
        sw_md5,
        sw_path,
        data_base64: base64Data,
      });

      const isUpdate = existingVersionMap.has(sw_id);
      if (isUpdate) {
        updatedCount++;
      } else {
        uploadedCount++;
      }

      logEvent({
        level: "INFO",
        source: "OTA_PACKAGE",
        event: isUpdate ? "PACKAGE_UPDATE" : "PACKAGE_UPLOAD",
        message: `${isUpdate ? "Updated" : "Uploaded"} ${sw_id} v${version}`,
        details: { size: arrayBuffer.byteLength },
      });
    }

    // index.json 메타데이터 저장
    await saveIndexMetadata(indexData);

    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "UPLOAD_COMPLETE",
      message: "OTA package upload completed",
      details: {
        total: indexData.services.length,
        uploaded: uploadedCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
    });

    return {
      success: true,
      total: indexData.services.length,
      uploaded: uploadedCount,
      updated: updatedCount,
      skipped: skippedCount,
    };
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA_PACKAGE",
      event: "UPLOAD_ERROR",
      message: "Failed to upload OTA package",
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 디렉토리에서 OTA 패키지 업로드 (웹의 경우 파일 선택)
 */
export async function uploadOtaPackageFromFiles(files) {
  try {
    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "UPLOAD_FILES_START",
      message: `Uploading OTA package from ${files.length} files`,
    });

    // index.json 찾기
    const indexFile = Array.from(files).find((f) => f.name === "index.json");
    if (!indexFile) {
      throw new Error("index.json not found in selected files");
    }

    // index.json 읽기
    const indexContent = await indexFile.text();
    const indexData = JSON.parse(indexContent);

    if (!indexData.services || !Array.isArray(indexData.services)) {
      throw new Error("Invalid index.json format");
    }

    // 파일 맵 생성 (경로 → 파일)
    const fileMap = new Map();
    for (const file of files) {
      // 웹 File API의 경우 webkitRelativePath 사용
      const path = file.webkitRelativePath || file.name;
      fileMap.set(path, file);
    }

    let uploadedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // 각 서비스 처리
    for (const service of indexData.services) {
      const { sw_id, version, sw_path, sw_md5 } = service;

      // 버전 비교
      const needsUpdate = await checkPackageNeedsUpdate(sw_id, version);

      if (!needsUpdate) {
        skippedCount++;
        continue;
      }

      // 파일 찾기 (여러 경로 패턴 시도)
      const normalizedPath = sw_path.startsWith("/")
        ? sw_path.substring(1)
        : sw_path;

      let packageFile = fileMap.get(normalizedPath);
      
      // 상대 경로로도 시도
      if (!packageFile) {
        for (const [path, file] of fileMap) {
          if (path.endsWith(normalizedPath)) {
            packageFile = file;
            break;
          }
        }
      }

      if (!packageFile) {
        logEvent({
          level: "WARN",
          source: "OTA_PACKAGE",
          event: "FILE_NOT_FOUND",
          message: `File not found: ${normalizedPath}`,
          details: { sw_id, version },
        });
        continue;
      }

      // 파일을 Base64로 읽기
      const arrayBuffer = await packageFile.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);

      // DB에 저장
      await savePackage({
        sw_id,
        version,
        sw_md5,
        sw_path,
        data_base64: base64Data,
      });

      const existing = await getAllPackages();
      const isUpdate = existing.some((p) => p.sw_id === sw_id);
      
      if (isUpdate) {
        updatedCount++;
      } else {
        uploadedCount++;
      }

      logEvent({
        level: "INFO",
        source: "OTA_PACKAGE",
        event: isUpdate ? "PACKAGE_UPDATE" : "PACKAGE_UPLOAD",
        message: `${isUpdate ? "Updated" : "Uploaded"} ${sw_id} v${version}`,
        details: { size: arrayBuffer.byteLength },
      });
    }

    // index.json 메타데이터 저장
    await saveIndexMetadata(indexData);

    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "UPLOAD_FILES_COMPLETE",
      message: "OTA package upload completed",
      details: {
        total: indexData.services.length,
        uploaded: uploadedCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
    });

    return {
      success: true,
      total: indexData.services.length,
      uploaded: uploadedCount,
      updated: updatedCount,
      skipped: skippedCount,
    };
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA_PACKAGE",
      event: "UPLOAD_FILES_ERROR",
      message: "Failed to upload OTA package from files",
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 모든 패키지 삭제
 */
export async function clearOtaPackages() {
  try {
    await clearAllPackages();
    await saveIndexMetadata(null);

    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "PACKAGES_CLEARED",
      message: "All OTA packages cleared",
    });

    return { success: true };
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA_PACKAGE",
      event: "CLEAR_ERROR",
      message: "Failed to clear OTA packages",
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * ArrayBuffer를 Base64로 변환
 */
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

/**
 * DB에서 로컬 index 가져오기
 */
export async function loadLocalIndexFromDb() {
  try {
    const indexData = await getIndexMetadata();
    
    if (!indexData) {
      throw new Error("No OTA packages found in database. Please upload a package first.");
    }

    logEvent({
      level: "INFO",
      source: "OTA_PACKAGE",
      event: "INDEX_LOADED",
      message: "Local index loaded from database",
      details: { services: indexData.services?.length || 0 },
    });

    return indexData;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA_PACKAGE",
      event: "INDEX_LOAD_ERROR",
      message: "Failed to load index from database",
      details: { error: error.message },
    });
    throw error;
  }
}