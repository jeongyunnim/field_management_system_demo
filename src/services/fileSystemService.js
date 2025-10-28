// src/services/fileSystemService.js
import { logEvent } from "../core/logger";

/**
 * Capacitor 동적 import (웹 개발 환경에서도 에러 없이 작동)
 */
let Capacitor, Filesystem, Encoding;

async function loadCapacitor() {
  if (Capacitor) return { Capacitor, Filesystem, Encoding };
  
  try {
    const capacitorCore = await import("@capacitor/core");
    const capacitorFilesystem = await import("@capacitor/filesystem");
    
    Capacitor = capacitorCore.Capacitor;
    Filesystem = capacitorFilesystem.Filesystem;
    Encoding = capacitorFilesystem.Encoding;
    
    return { Capacitor, Filesystem, Encoding };
  } catch (error) {
    // Capacitor 없어도 계속 진행 (웹 개발 환경)
    console.warn("Capacitor not available, using web fallback");
    return { Capacitor: null, Filesystem: null, Encoding: null };
  }
}

/**
 * 플랫폼 감지
 */
async function getPlatform() {
  const cap = await loadCapacitor();
  
  if (cap.Capacitor && typeof cap.Capacitor.getPlatform === "function") {
    return cap.Capacitor.getPlatform();
  }
  
  // Electron 감지
  if (typeof window.electronAPI !== "undefined") {
    return "electron";
  }
  
  return "web";
}

/**
 * 파일 존재 여부 확인
 */
export async function fileExists(filePath) {
  try {
    const platform = await getPlatform();

    if (platform === "web") {
      // 웹 환경: fetch로 확인
      const response = await fetch(filePath, { method: "HEAD" });
      return response.ok;
    }

    if (platform === "android" || platform === "ios") {
      // Capacitor: stat으로 확인
      const cap = await loadCapacitor();
      try {
        await cap.Filesystem.stat({ path: filePath });
        return true;
      } catch {
        return false;
      }
    }

    // Electron
    if (platform === "electron") {
      return await window.electronAPI.fileExists(filePath);
    }

    return false;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "FILE_EXISTS_CHECK_FAIL",
      message: `Failed to check file existence: ${filePath}`,
      details: { error: error.message },
    });
    return false;
  }
}

/**
 * 디렉토리 존재 여부 확인
 */
export async function directoryExists(dirPath) {
  return fileExists(dirPath);
}

/**
 * JSON 파일 읽기
 */
export async function readJsonFile(filePath) {
  try {
    const platform = await getPlatform();

    if (platform === "web") {
      // 웹 환경: fetch 사용
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    }

    if (platform === "android" || platform === "ios") {
      // Capacitor: Filesystem API 사용
      const cap = await loadCapacitor();
      const result = await cap.Filesystem.readFile({
        path: filePath,
        encoding: cap.Encoding.UTF8,
      });
      return JSON.parse(result.data);
    }

    // Electron
    if (platform === "electron") {
      const content = await window.electronAPI.readFile(filePath, "utf8");
      return JSON.parse(content);
    }

    throw new Error("Unsupported platform");
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "READ_JSON_FAIL",
      message: `Failed to read JSON file: ${filePath}`,
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 바이너리 파일을 Base64로 읽기
 */
export async function readFileAsBase64(filePath) {
  try {
    const platform = await getPlatform();

    if (platform === "web") {
      // 웹 환경: fetch + FileReader
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(",")[1]; // data:...;base64, 제거
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    if (platform === "android" || platform === "ios") {
      // Capacitor: Filesystem API 사용 (Base64 직접 읽기)
      const cap = await loadCapacitor();
      const result = await cap.Filesystem.readFile({
        path: filePath,
      });
      // Capacitor는 기본적으로 Base64로 반환
      return result.data;
    }

    // Electron
    if (platform === "electron") {
      const buffer = await window.electronAPI.readFile(filePath);
      return Buffer.from(buffer).toString("base64");
    }

    throw new Error("Unsupported platform");
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "READ_FILE_BASE64_FAIL",
      message: `Failed to read file as Base64: ${filePath}`,
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 디렉토리 선택 (Settings에서 사용)
 */
export async function selectDirectory() {
  try {
    const platform = await getPlatform();

    if (platform === "web") {
      // 웹 환경: File System Access API (Chrome 86+) 또는 수동 입력
      if ("showDirectoryPicker" in window) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          // 웹에서는 전체 경로를 얻을 수 없으므로 수동 입력 권장
          alert("웹 브라우저에서는 전체 경로를 얻을 수 없습니다.\n직접 경로를 입력해주세요.");
          return null;
        } catch (err) {
          if (err.name === "AbortError") {
            return null;
          }
          throw err;
        }
      }
      
      // 수동 입력
      const path = prompt(
        "OTA 업데이트 파일 디렉토리 경로를 입력하세요:\n\n" +
        "웹 개발: /ota (public 폴더)\n" +
        "앱: /storage/emulated/0/OTA (Android)\n" +
        "앱: file:///var/mobile/... (iOS)"
      );
      return path;
    }

    if (platform === "android" || platform === "ios") {
      // Capacitor: 디렉토리 선택 플러그인 필요
      // @capacitor-community/file-picker 등 사용 가능
      const path = prompt(
        "OTA 업데이트 파일 디렉토리 경로를 입력하세요:\n\n" +
        "Android: /storage/emulated/0/OTA\n" +
        "iOS: Documents/OTA"
      );
      return path;
    }

    // Electron
    if (platform === "electron") {
      return await window.electronAPI.selectDirectory();
    }

    throw new Error("Unsupported platform");
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "SELECT_DIRECTORY_FAIL",
      message: "Failed to select directory",
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 경로 유효성 검증 (index.json 존재 여부)
 */
export async function validateOtaPath(basePath) {
  try {
    if (!basePath) return false;

    const indexPath = `${basePath}/index.json`;
    const exists = await fileExists(indexPath);

    if (!exists) {
      logEvent({
        level: "WARN",
        source: "FILESYSTEM",
        event: "OTA_PATH_INVALID",
        message: `index.json not found at: ${indexPath}`,
      });
      return false;
    }

    logEvent({
      level: "INFO",
      source: "FILESYSTEM",
      event: "OTA_PATH_VALID",
      message: `Valid OTA path: ${basePath}`,
    });

    return true;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "VALIDATE_PATH_FAIL",
      message: "Failed to validate OTA path",
      details: { error: error.message, basePath },
    });
    return false;
  }
}

/**
 * 파일 크기 확인
 */
export async function getFileSize(filePath) {
  try {
    const platform = await getPlatform();

    if (platform === "web") {
      const response = await fetch(filePath, { method: "HEAD" });
      const contentLength = response.headers.get("content-length");
      return contentLength ? parseInt(contentLength, 10) : 0;
    }

    if (platform === "android" || platform === "ios") {
      const cap = await loadCapacitor();
      const stat = await cap.Filesystem.stat({ path: filePath });
      return stat.size;
    }

    if (platform === "electron") {
      return await window.electronAPI.getFileSize(filePath);
    }

    return 0;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "FILESYSTEM",
      event: "GET_FILE_SIZE_FAIL",
      message: `Failed to get file size: ${filePath}`,
      details: { error: error.message },
    });
    return 0;
  }
}