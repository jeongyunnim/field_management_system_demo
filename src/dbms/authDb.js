// src/dbms/authDb.js (평문 버전)
import Dexie from "dexie";

export const authDb = new Dexie("AuthDB");

authDb.version(1).stores({
  credentials: "id, username, password, version, updatedAt",
  authLogs: "++id, timestamp, action, details", // 디버깅용 로그
});

// 기본 비밀번호 (평문)
const DEFAULT_PASSWORD = "admin1234";

const DEFAULT_CREDENTIALS = {
  id: 1,
  username: "admin",
  password: DEFAULT_PASSWORD,
  version: "1.0",
  updatedAt: Date.now(),
};

/**
 * 인증 로그 저장 (안드로이드 디버깅용)
 */
export async function logAuth(action, details = {}) {
  try {
    await authDb.authLogs.add({
      timestamp: Date.now(),
      action,
      details,
    });
    
    // 안드로이드 네이티브 로그 (Android WebView에서 사용)
    if (window.Android && window.Android.log) {
      window.Android.log(`[Auth] ${action}: ${JSON.stringify(details)}`);
    }
    
    // 콘솔 로그 (개발 환경)
    console.log(`[Auth] ${action}:`, details);
  } catch (error) {
    console.error("Failed to log auth action:", error);
  }
}

/**
 * 인증 로그 조회
 */
export async function getAuthLogs(limit = 50) {
  try {
    return await authDb.authLogs
      .orderBy("timestamp")
      .reverse()
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error("Failed to get auth logs:", error);
    return [];
  }
}

/**
 * 최근 로그 조회 (별칭)
 */
export const getRecentLogs = getAuthLogs;

/**
 * 인증 로그 초기화
 */
export async function clearAuthLogs() {
  try {
    await authDb.authLogs.clear();
    await logAuth("LOGS_CLEARED", { timestamp: Date.now() });
  } catch (error) {
    console.error("Failed to clear auth logs:", error);
  }
}

/**
 * 인증 로그 초기화 (별칭)
 */
export const clearLogs = clearAuthLogs;

/**
 * DB 상태 조회
 */
export async function getDbStatus() {
  try {
    const credentials = await authDb.credentials.get(1);
    const logsCount = await authDb.authLogs.count();
    const lastLog = await authDb.authLogs
      .orderBy("timestamp")
      .reverse()
      .first();

    const status = {
      isInitialized: !!credentials,
      hasCredentials: !!credentials,
      username: credentials?.username || null,
      version: credentials?.version || null,
      lastUpdated: credentials?.updatedAt || null,
      logsCount,
      lastLogTimestamp: lastLog?.timestamp || null,
      lastLogAction: lastLog?.action || null,
      platform: window.Android ? "Android WebView" : "Web Browser",
      indexedDBSupported: !!window.indexedDB,
      databaseName: authDb.name,
    };

    await logAuth("DB_STATUS_CHECK", {
      isInitialized: status.isInitialized,
      logsCount: status.logsCount,
    });

    return status;
  } catch (error) {
    console.error("Failed to get DB status:", error);
    return {
      isInitialized: false,
      hasCredentials: false,
      error: error.message,
      platform: window.Android ? "Android WebView" : "Web Browser",
      indexedDBSupported: !!window.indexedDB,
    };
  }
}

/**
 * 자격 증명 로드
 */
export async function loadCredentials() {
  try {
    await logAuth("LOAD_CREDENTIALS_START");
    
    const stored = await authDb.credentials.get(1);
    
    if (stored) {
      await logAuth("LOAD_CREDENTIALS_SUCCESS", {
        username: stored.username,
        version: stored.version,
        hasPassword: !!stored.password,
      });
      
      return stored;
    } else {
      // DB가 비어있으면 기본값으로 초기화
      await logAuth("LOAD_CREDENTIALS_EMPTY", { action: "initializing" });
      await saveCredentials(DEFAULT_CREDENTIALS);
      return DEFAULT_CREDENTIALS;
    }
  } catch (error) {
    await logAuth("LOAD_CREDENTIALS_ERROR", { error: error.message });
    console.error("Failed to load credentials:", error);
    
    // 에러 발생 시 기본값 저장
    await saveCredentials(DEFAULT_CREDENTIALS);
    return DEFAULT_CREDENTIALS;
  }
}

/**
 * 자격 증명 저장
 */
export async function saveCredentials(credentials) {
  try {
    const dataToSave = {
      ...credentials,
      id: 1, // 항상 ID 1로 저장 (단일 계정)
      updatedAt: Date.now(),
    };
    
    await authDb.credentials.put(dataToSave);
    
    await logAuth("SAVE_CREDENTIALS_SUCCESS", {
      username: credentials.username,
      version: credentials.version,
    });
    
    return true;
  } catch (error) {
    await logAuth("SAVE_CREDENTIALS_ERROR", { error: error.message });
    console.error("Failed to save credentials:", error);
    return false;
  }
}

/**
 * localStorage에서 IndexedDB로 마이그레이션
 */
export async function migrateFromLocalStorage() {
  try {
    const STORAGE_KEY = "v2x_maintenance_auth";
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (!stored) {
      await logAuth("MIGRATION_NO_LOCALSTORAGE");
      return false;
    }
    
    await logAuth("MIGRATION_START", { source: "localStorage" });
    
    const oldCredentials = JSON.parse(stored);
    
    // IndexedDB에 저장
    await saveCredentials({
      ...oldCredentials,
      version: "1.0",
    });
    
    // localStorage 정리
    localStorage.removeItem(STORAGE_KEY);
    
    await logAuth("MIGRATION_SUCCESS", { cleared: "localStorage" });
    return true;
  } catch (error) {
    await logAuth("MIGRATION_ERROR", { error: error.message });
    console.error("Migration failed:", error);
    return false;
  }
}

/**
 * 자격 증명 초기화
 */
export async function resetCredentials() {
  try {
    await logAuth("RESET_CREDENTIALS_START");
    await saveCredentials(DEFAULT_CREDENTIALS);
    await logAuth("RESET_CREDENTIALS_SUCCESS");
    return true;
  } catch (error) {
    await logAuth("RESET_CREDENTIALS_ERROR", { error: error.message });
    console.error("Failed to reset credentials:", error);
    return false;
  }
}

/**
 * 비밀번호 검증 (평문 비교)
 */
export async function verifyPassword(inputPassword, storedPassword) {
  await logAuth("VERIFY_PASSWORD", { 
    inputLength: inputPassword?.length,
    storedLength: storedPassword?.length 
  });
  
  return inputPassword === storedPassword;
}

/**
 * 비밀번호 변경
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    const credentials = await loadCredentials();
    
    await logAuth("CHANGE_PASSWORD_START", { username: credentials.username });
    
    // 현재 비밀번호 확인 (평문 비교)
    const isValid = await verifyPassword(currentPassword, credentials.password);
    
    if (!isValid) {
      await logAuth("CHANGE_PASSWORD_FAILED", { reason: "invalid_current_password" });
      return { success: false, error: "현재 비밀번호가 일치하지 않습니다." };
    }
    
    // 새 비밀번호 저장 (평문)
    const newCredentials = {
      ...credentials,
      password: newPassword,
      updatedAt: Date.now(),
    };
    
    await saveCredentials(newCredentials);
    await logAuth("CHANGE_PASSWORD_SUCCESS", { username: credentials.username });
    
    return { success: true };
  } catch (error) {
    await logAuth("CHANGE_PASSWORD_ERROR", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 사용자 이름 변경
 */
export async function changeUsername(password, newUsername) {
  try {
    const credentials = await loadCredentials();
    
    await logAuth("CHANGE_USERNAME_START", {
      oldUsername: credentials.username,
      newUsername,
    });
    
    // 비밀번호 확인 (평문 비교)
    const isValid = await verifyPassword(password, credentials.password);
    
    if (!isValid) {
      await logAuth("CHANGE_USERNAME_FAILED", { reason: "invalid_password" });
      return { success: false, error: "비밀번호가 일치하지 않습니다." };
    }
    
    const newCredentials = {
      ...credentials,
      username: newUsername,
      updatedAt: Date.now(),
    };
    
    await saveCredentials(newCredentials);
    await logAuth("CHANGE_USERNAME_SUCCESS", {
      oldUsername: credentials.username,
      newUsername,
    });
    
    return { success: true };
  } catch (error) {
    await logAuth("CHANGE_USERNAME_ERROR", { error: error.message });
    return { success: false, error: error.message };
  }
}

// 초기화: localStorage에서 마이그레이션 시도
(async () => {
  try {
    await migrateFromLocalStorage();
    
    // 초기 자격 증명 로드 (없으면 생성)
    await loadCredentials();
  } catch (error) {
    console.error("Auth DB initialization failed:", error);
  }
})();