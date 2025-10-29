// src/stores/AuthStore.js (평문 버전)
import { create } from "zustand";
import {
  loadCredentials,
  saveCredentials,
  resetCredentials as dbResetCredentials,
  changePassword as dbChangePassword,
  changeUsername as dbChangeUsername,
  verifyPassword,
  logAuth,
} from "../dbms/authDb";

export const useAuthStore = create((set, get) => ({
  // 상태
  // TODO: 절대 바꾸기.
  isAuthenticated: true,
  currentUser: null,
  credentials: null,
  isLoading: true,

  /**
   * 초기화: DB에서 자격 증명 로드
   */
  initialize: async () => {
    try {
      await logAuth("STORE_INITIALIZE_START");
      const credentials = await loadCredentials();
      
      set({
        credentials,
        isLoading: false,
      });
      
      await logAuth("STORE_INITIALIZE_SUCCESS", {
        username: credentials.username,
      });
    } catch (error) {
      await logAuth("STORE_INITIALIZE_ERROR", { error: error.message });
      console.error("Failed to initialize auth store:", error);
      set({ isLoading: false });
    }
  },

  /**
   * 로그인
   */
  login: (username, password) => {
    const { credentials } = get();

    if (!credentials) {
      logAuth("LOGIN_FAILED", { reason: "no_credentials" });
      return { success: false, error: "시스템 오류가 발생했습니다." };
    }

    // 사용자 이름 확인
    if (username !== credentials.username) {
      logAuth("LOGIN_FAILED", { 
        reason: "invalid_username",
        attempted: username 
      });
      return { success: false, error: "사용자 이름 또는 비밀번호가 올바르지 않습니다." };
    }

    // 비밀번호 확인 (평문 비교)
    if (password !== credentials.password) {
      logAuth("LOGIN_FAILED", { 
        reason: "invalid_password",
        username 
      });
      return { success: false, error: "사용자 이름 또는 비밀번호가 올바르지 않습니다." };
    }

    // 로그인 성공
    set({
      isAuthenticated: true,
      currentUser: credentials.username,
    });

    logAuth("LOGIN_SUCCESS", { username: credentials.username });
    return { success: true };
  },

  /**
   * 로그아웃
   */
  logout: () => {
    const { currentUser } = get();
    
    set({
      isAuthenticated: false,
      currentUser: null,
    });

    logAuth("LOGOUT", { username: currentUser });
  },

  /**
   * 비밀번호 변경
   */
  changePassword: (currentPassword, newPassword) => {
    const { credentials } = get();

    if (!credentials) {
      return { success: false, error: "시스템 오류가 발생했습니다." };
    }

    // 현재 비밀번호 확인 (평문 비교)
    if (currentPassword !== credentials.password) {
      logAuth("CHANGE_PASSWORD_FAILED", { 
        reason: "invalid_current_password",
        username: credentials.username 
      });
      return { success: false, error: "현재 비밀번호가 일치하지 않습니다." };
    }

    // 비밀번호 유효성 검사
    if (newPassword.length < 6) {
      return { success: false, error: "비밀번호는 최소 6자 이상이어야 합니다." };
    }

    // 새 비밀번호로 업데이트 (평문)
    const newCredentials = {
      ...credentials,
      password: newPassword,
      updatedAt: Date.now(),
    };

    saveCredentials(newCredentials);
    set({ credentials: newCredentials });

    logAuth("CHANGE_PASSWORD_SUCCESS", { username: credentials.username });
    return { success: true };
  },

  /**
   * 사용자 이름 변경
   */
  changeUsername: (password, newUsername) => {
    const { credentials } = get();

    if (!credentials) {
      return { success: false, error: "시스템 오류가 발생했습니다." };
    }

    // 비밀번호 확인 (평문 비교)
    if (password !== credentials.password) {
      logAuth("CHANGE_USERNAME_FAILED", { 
        reason: "invalid_password",
        username: credentials.username 
      });
      return { success: false, error: "비밀번호가 일치하지 않습니다." };
    }

    // 사용자 이름 유효성 검사
    if (newUsername.length < 3) {
      return { success: false, error: "사용자 이름은 최소 3자 이상이어야 합니다." };
    }

    // 새 사용자 이름으로 업데이트
    const newCredentials = {
      ...credentials,
      username: newUsername,
      updatedAt: Date.now(),
    };

    saveCredentials(newCredentials);
    set({
      credentials: newCredentials,
      currentUser: newUsername,
    });

    logAuth("CHANGE_USERNAME_SUCCESS", {
      oldUsername: credentials.username,
      newUsername,
    });
    return { success: true };
  },

  /**
   * 자격 증명 초기화 (admin/admin1234)
   */
  resetCredentials: async () => {
    await dbResetCredentials();
    const credentials = await loadCredentials();
    
    set({
      credentials,
      isAuthenticated: false,
      currentUser: null,
    });

    logAuth("CREDENTIALS_RESET", { newUsername: credentials.username });
  },
}));

// 앱 시작 시 자격 증명 로드
useAuthStore.getState().initialize();