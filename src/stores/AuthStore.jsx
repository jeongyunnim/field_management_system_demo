// src/stores/AuthStore.js
import { create } from "zustand";

const DEFAULT_CREDENTIALS = {
  username: "admin",
  password: "admin1234",
};

// localStorage 키
const STORAGE_KEY = "v2x_maintenance_auth";

/**
 * localStorage에서 자격 증명 로드
 */
function loadCredentials() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load credentials:", error);
  }
  return DEFAULT_CREDENTIALS;
}

/**
 * localStorage에 자격 증명 저장
 */
function saveCredentials(credentials) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch (error) {
    console.error("Failed to save credentials:", error);
  }
}

export const useAuthStore = create((set, get) => ({
  // 로그인 상태
  isAuthenticated: false,
  currentUser: null,

  // 저장된 자격 증명
  credentials: loadCredentials(),

  /**
   * 로그인
   */
  login: (username, password) => {
    const { credentials } = get();

    if (username === credentials.username && password === credentials.password) {
      set({
        isAuthenticated: true,
        currentUser: username,
      });
      return { success: true };
    }

    return {
      success: false,
      error: "사용자 이름 또는 비밀번호가 일치하지 않습니다.",
    };
  },

  /**
   * 로그아웃
   */
  logout: () => {
    set({
      isAuthenticated: false,
      currentUser: null,
    });
  },

  /**
   * 비밀번호 변경
   */
  changePassword: (currentPassword, newPassword) => {
    const { credentials } = get();

    if (currentPassword !== credentials.password) {
      return {
        success: false,
        error: "현재 비밀번호가 일치하지 않습니다.",
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        error: "비밀번호는 6자 이상이어야 합니다.",
      };
    }

    const newCredentials = {
      ...credentials,
      password: newPassword,
    };

    saveCredentials(newCredentials);
    set({ credentials: newCredentials });

    return { success: true };
  },

  /**
   * 사용자 이름 변경
   */
  changeUsername: (password, newUsername) => {
    const { credentials } = get();

    if (password !== credentials.password) {
      return {
        success: false,
        error: "비밀번호가 일치하지 않습니다.",
      };
    }

    if (newUsername.length < 3) {
      return {
        success: false,
        error: "사용자 이름은 3자 이상이어야 합니다.",
      };
    }

    const newCredentials = {
      ...credentials,
      username: newUsername,
    };

    saveCredentials(newCredentials);
    set({
      credentials: newCredentials,
      currentUser: newUsername,
    });

    return { success: true };
  },

  /**
   * 자격 증명 초기화 (기본값으로 복원)
   */
  resetCredentials: () => {
    saveCredentials(DEFAULT_CREDENTIALS);
    set({
      credentials: DEFAULT_CREDENTIALS,
      isAuthenticated: false,
      currentUser: null,
    });
  },
}));