// src/services/ota/otaService.js
import { useOtaStore } from "../../stores/OtaStore";
import { OTA_CONFIG } from "../../constants/appConstants";
import { logEvent } from "../../core/logger";
import { 
  requestDeviceVersionWithRetry, 
  performDeviceUpdate,
  requestDeviceReboot 
} from "../mqtt/directPool";
import {
  getPackage,
  getIndexMetadata,
} from "../../dbms/otaDb";
import { loadLocalIndexFromDb } from "./otaPackageService";

/**
 * 버전 비교 (semantic versioning)
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
}

/**
 * 로컬 index.json 로드 (DB에서)
 */
export async function loadLocalIndex() {
  try {
    const indexData = await loadLocalIndexFromDb();
    useOtaStore.getState().loadLocalIndex(indexData);
    return indexData;
  } catch (error) {
    // DB에 데이터가 없으면 빈 index 반환
    useOtaStore.getState().loadLocalIndex(null);
    throw error;
  }
}

/**
 * 업데이트 가능 항목 찾기
 */
export function findAvailableUpdates(deviceVersions, localIndex) {
  if (!localIndex || !localIndex.services) {
    return [];
  }
  
  const updates = [];
  
  for (const entry of deviceVersions.entries || []) {
    const { sw_id, version: currentVersion, md5_ok } = entry;
    
    const localService = localIndex.services.find((s) => s.sw_id === sw_id);
    
    if (!localService) {
      continue;
    }
    
    const availableVersion = localService.version;
    const needsUpdate = 
      compareVersions(availableVersion, currentVersion) > 0;
      // NOTICE TODO: M
      // !md5_ok;
    
    if (needsUpdate) {
      updates.push({
        sw_id,
        currentVersion,
        availableVersion,
        sw_path: localService.sw_path,
        sw_md5: localService.sw_md5,
        reason: "Version upgrade",
      });
    }
  }
  
  return updates;
}

/**
 * DB에서 패키지 데이터 로드
 */
async function loadPackageFromDb(sw_id) {
  try {
    const packageData = await getPackage(sw_id);

    if (!packageData) {
      throw new Error(`Package not found in database: ${sw_id}`);
    }

    if (!packageData.data_base64) {
      throw new Error(`Package data is empty: ${sw_id}`);
    }

    // 파일 크기 체크 (Base64 문자열 길이 * 0.75)
    const estimatedSize = packageData.data_base64.length * 0.75;
    if (estimatedSize > OTA_CONFIG.MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${Math.round(estimatedSize)} bytes (max: ${OTA_CONFIG.MAX_FILE_SIZE})`
      );
    }

    logEvent({
      level: "INFO",
      source: "OTA",
      event: "FILE_LOADED_FROM_DB",
      message: `Loaded ${sw_id} v${packageData.version} from database`,
      details: { size: Math.round(estimatedSize) },
    });

    return packageData.data_base64;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA",
      event: "FILE_LOAD_FROM_DB_FAIL",
      message: `Failed to load ${sw_id} from database`,
      details: { error: error.message },
    });
    throw error;
  }
}

/**
 * 업데이트 요청 생성
 */
async function buildUpdateRequest(updates, transactionId) {
  const entries = [];
  
  for (const update of updates) {
    try {
      const base64Data = await loadPackageFromDb(update.sw_id);
      
      entries.push({
        sw_id: update.sw_id,
        version: update.availableVersion,
        sw_md5: update.sw_md5,
        data_base64: base64Data,
      });
      
      logEvent({
        level: "INFO",
        source: "OTA",
        event: "FILE_PREPARED",
        message: `Prepared ${update.sw_id} v${update.availableVersion}`,
      });
    } catch (error) {
      logEvent({
        level: "ERROR",
        source: "OTA",
        event: "FILE_PREPARE_SKIP",
        message: `Skipped ${update.sw_id}: ${error.message}`,
      });
      continue;
    }
  }
  
  return {
    transaction_id: transactionId,
    entries,
  };
}

/**
 * RSE 연결 시 버전 체크
 */
export async function checkDeviceVersion(deviceId, pktOrIp) {
  const otaStore = useOtaStore.getState();

  // DB에 패키지가 있는지 확인
  const indexData = await getIndexMetadata();
  if (!indexData) {
    otaStore.setDeviceStatus(deviceId, {
      checking: false,
      hasUpdate: false,
      error: "No OTA packages in database",
    });
    return;
  }

  otaStore.setDeviceStatus(deviceId, {
    checking: true,
    hasUpdate: false,
    error: null,
  });

  try {
    const versionData = await requestDeviceVersionWithRetry(pktOrIp, 3);
    
    otaStore.setDeviceVersions(deviceId, versionData);
    
    const localIndex = otaStore.localIndex || indexData;
    if (localIndex) {
      const updates = findAvailableUpdates(versionData, localIndex);
      
      if (updates.length > 0) {
        otaStore.setAvailableUpdates(deviceId, updates);
        otaStore.setDeviceStatus(deviceId, {
          checking: false,
          hasUpdate: true,
          updateCount: updates.length,
          error: null,
        });
        
        logEvent({
          level: "INFO",
          source: "OTA",
          entity: deviceId,
          event: "UPDATES_AVAILABLE",
          message: `Found ${updates.length} available updates`,
          details: { 
            updates: updates.map((u) => ({
              sw_id: u.sw_id,
              from: u.currentVersion,
              to: u.availableVersion,
              reason: u.reason,
            }))
          },
        });
      } else {
        otaStore.setDeviceStatus(deviceId, {
          checking: false,
          hasUpdate: false,
          error: null,
        });
        
        logEvent({
          level: "INFO",
          source: "OTA",
          entity: deviceId,
          event: "NO_UPDATES",
          message: "Device is up to date",
        });
      }
    }
  } catch (error) {
    otaStore.setDeviceStatus(deviceId, {
      checking: false,
      hasUpdate: false,
      error: error.message,
    });
    
    logEvent({
      level: "ERROR",
      source: "OTA",
      entity: deviceId,
      event: "VERSION_CHECK_ERROR",
      message: "Failed to check device version",
      details: { error: error.message },
    });
  }
}

/**
 * 업데이트 수행
 */
export async function performUpdate(deviceId, pktOrIp) {
  const otaStore = useOtaStore.getState();
  const updates = otaStore.availableUpdates[deviceId];

  // DB 확인
  const indexData = await getIndexMetadata();
  if (!indexData) {
    alert("OTA 패키지가 DB에 없습니다.\nSettings에서 패키지를 업로드하세요.");
    return;
  }
  
  if (!updates || updates.length === 0) {
    alert("업데이트할 항목이 없습니다.");
    return;
  }

  const message = `${updates.length}개의 업데이트를 진행하시겠습니까?\n\n` +
    updates.map((u) => `• ${u.sw_id}: ${u.currentVersion} → ${u.availableVersion} (${u.reason})`).join("\n");
  
  if (!window.confirm(message)) {
    return;
  }

  otaStore.startUpdating(deviceId);

  try {
    const transactionId = Date.now() % 100000;
    
    logEvent({
      level: "INFO",
      source: "OTA",
      entity: deviceId,
      event: "UPDATE_START",
      message: `Starting update (tx: ${transactionId})`,
      details: { updateCount: updates.length },
    });

    const request = await buildUpdateRequest(updates, transactionId);
    
    if (request.entries.length === 0) {
      throw new Error("업데이트 파일을 DB에서 로드할 수 없습니다.");
    }

    otaStore.setUpdateProgress(deviceId, {
      status: "uploading",
      message: `${request.entries.length}개 파일 전송 중...`,
      progress: 50,
      transactionId,
    });

    const response = await performDeviceUpdate(pktOrIp, request);

    const allSuccess = response.entries.every((e) => e.code === "200");
    const failedEntries = response.entries.filter((e) => e.code !== "200");

    otaStore.stopUpdating();
    otaStore.setUpdateProgress(deviceId, null);

    if (allSuccess) {
      logEvent({
        level: "INFO",
        source: "OTA",
        entity: deviceId,
        event: "UPDATE_SUCCESS",
        message: "All updates succeeded",
      });

      otaStore.setAvailableUpdates(deviceId, []);
      otaStore.setDeviceStatus(deviceId, {
        checking: false,
        hasUpdate: false,
        error: null,
      });

      const shouldReboot = window.confirm(
        "업데이트가 완료되었습니다.\n재부팅하시겠습니까?"
      );

      if (shouldReboot) {
        await handleReboot(deviceId, pktOrIp);
      } else {
        alert("업데이트가 완료되었습니다.");
      }
    } else {
      logEvent({
        level: "ERROR",
        source: "OTA",
        entity: deviceId,
        event: "UPDATE_PARTIAL_FAIL",
        message: `${failedEntries.length} updates failed`,
        details: { failed: failedEntries },
      });

      const failedList = failedEntries
        .map((e) => `• ${e.sw_id} v${e.version}: code ${e.code}`)
        .join("\n");

      alert(`일부 업데이트가 실패했습니다:\n\n${failedList}`);
    }
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA",
      entity: deviceId,
      event: "UPDATE_ERROR",
      message: "Update failed",
      details: { error: error.message },
    });

    otaStore.stopUpdating();
    otaStore.setUpdateProgress(deviceId, null);

    alert(`업데이트 실패: ${error.message}`);
  }
}

/**
 * 재부팅 처리
 */
async function handleReboot(deviceId, pktOrIp) {
  try {
    logEvent({
      level: "INFO",
      source: "OTA",
      entity: deviceId,
      event: "REBOOT_START",
      message: "Requesting device reboot",
    });

    await requestDeviceReboot(pktOrIp);

    alert("재부팅 요청을 전송했습니다.\n장치가 재시작됩니다.");

    useOtaStore.getState().setDeviceStatus(deviceId, {
      checking: false,
      hasUpdate: false,
      error: null,
    });
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA",
      entity: deviceId,
      event: "REBOOT_ERROR",
      message: "Reboot request failed",
      details: { error: error.message },
    });

    alert(`재부팅 요청 실패: ${error.message}`);
  }
}

/**
 * RSE 연결 해제 시 호출
 */
export function handleDeviceDisconnect(deviceId) {
  const otaStore = useOtaStore.getState();
  
  if (otaStore.isUpdating && otaStore.updateProgress[deviceId]) {
    otaStore.stopUpdating();
    otaStore.setUpdateProgress(deviceId, null);
  }

  otaStore.setDeviceStatus(deviceId, {
    checking: false,
    hasUpdate: false,
    error: "연결 끊김",
  });

  logEvent({
    level: "INFO",
    source: "OTA",
    entity: deviceId,
    event: "DEVICE_DISCONNECT",
    message: "Device disconnected, OTA state cleared",
  });
}

/**
 * RSE 재연결 시 호출
 */
export async function handleDeviceReconnect(deviceId, pktOrIp) {
  logEvent({
    level: "INFO",
    source: "OTA",
    entity: deviceId,
    event: "DEVICE_RECONNECT",
    message: "Device reconnected, checking version",
  });

  await checkDeviceVersion(deviceId, pktOrIp);
}