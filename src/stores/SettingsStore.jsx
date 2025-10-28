// src/stores/SettingsStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 설정 관리 스토어 (확장)
 */
export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ==================== OTA 설정 ====================
      otaBasePath: "",
      otaPathValid: false,

      setOtaBasePath: (path) => {
        set({ otaBasePath: path, otaPathValid: false });
      },

      setOtaPathValid: (valid) => {
        set({ otaPathValid: valid });
      },

      resetOtaPath: () => {
        set({ otaBasePath: "", otaPathValid: false });
      },

      getIndexPath: () => {
        const { otaBasePath } = get();
        if (!otaBasePath) return null;
        return `${otaBasePath}/index.json`;
      },

      getFilePath: (relativePath) => {
        const { otaBasePath } = get();
        if (!otaBasePath) return null;
        return `${otaBasePath}${relativePath}`;
      },

      // ==================== FMS 설정 (Threshold) ====================
      fmsThresholds: {
        cpu: {
          warning: 80,
          critical: 90,
        },
        memory: {
          warning: 80,
          critical: 90,
        },
        disk: {
          warning: 80,
          critical: 90,
        },
        temperature: {
          warning: 70,
          critical: 85,
        },
        rssi: {
          warning: -80,
          critical: -90,
        },
        certificateDays: {
          warning: 30,
          critical: 7,
        },
      },

      setFmsThreshold: (category, level, value) => {
        set((state) => ({
          fmsThresholds: {
            ...state.fmsThresholds,
            [category]: {
              ...state.fmsThresholds[category],
              [level]: value,
            },
          },
        }));
      },

      resetFmsThresholds: () => {
        set({
          fmsThresholds: {
            cpu: { warning: 80, critical: 90 },
            memory: { warning: 80, critical: 90 },
            disk: { warning: 80, critical: 90 },
            temperature: { warning: 70, critical: 85 },
            rssi: { warning: -80, critical: -90 },
            certificateDays: { warning: 30, critical: 7 },
          },
        });
      },

      // ==================== 계정 설정 ====================
      account: {
        username: "admin",
        role: "admin", // admin, operator, viewer
        email: "",
        lastLogin: null,
      },

      setAccountInfo: (info) => {
        set((state) => ({
          account: {
            ...state.account,
            ...info,
          },
        }));
      },

      updateLastLogin: () => {
        set((state) => ({
          account: {
            ...state.account,
            lastLogin: new Date().toISOString(),
          },
        }));
      },

      // ==================== 일반 설정 ====================
      general: {
        language: "ko", // ko, en
        theme: "dark", // dark, light, auto
        dateFormat: "YYYY-MM-DD HH:mm:ss",
        timezone: "Asia/Seoul",
        autoRefreshInterval: 5000, // ms
        logLevel: "INFO", // DEBUG, INFO, WARN, ERROR
        enableNotifications: true,
        enableSounds: false,
        pageSize: 50, // 테이블 페이지 크기
      },

      setGeneralSetting: (key, value) => {
        set((state) => ({
          general: {
            ...state.general,
            [key]: value,
          },
        }));
      },

      resetGeneralSettings: () => {
        set({
          general: {
            language: "ko",
            theme: "dark",
            dateFormat: "YYYY-MM-DD HH:mm:ss",
            timezone: "Asia/Seoul",
            autoRefreshInterval: 5000,
            logLevel: "INFO",
            enableNotifications: true,
            enableSounds: false,
            pageSize: 50,
          },
        });
      },

      // ==================== MQTT 설정 ====================
      mqtt: {
        broker: "mqtt://localhost:1883",
        username: "",
        password: "",
        clientId: "rse-manager",
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30000,
      },

      setMqttSetting: (key, value) => {
        set((state) => ({
          mqtt: {
            ...state.mqtt,
            [key]: value,
          },
        }));
      },

      resetMqttSettings: () => {
        set({
          mqtt: {
            broker: "mqtt://localhost:1883",
            username: "",
            password: "",
            clientId: "rse-manager",
            keepalive: 60,
            reconnectPeriod: 1000,
            connectTimeout: 30000,
          },
        });
      },

      // ==================== 알림 설정 ====================
      notifications: {
        deviceOffline: true,
        healthIssue: true,
        certificateExpiry: true,
        updateAvailable: true,
        systemError: true,
        lowRssi: false,
        highTemperature: true,
        diskFull: true,
      },

      setNotificationSetting: (key, value) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        }));
      },

      toggleNotification: (key) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: !state.notifications[key],
          },
        }));
      },

      // ==================== 전체 초기화 ====================
      resetAllSettings: () => {
        get().resetOtaPath();
        get().resetFmsThresholds();
        get().resetGeneralSettings();
        get().resetMqttSettings();
      },

      // ==================== 설정 내보내기/가져오기 ====================
      exportSettings: () => {
        const state = get();
        return {
          fmsThresholds: state.fmsThresholds,
          general: state.general,
          mqtt: state.mqtt,
          notifications: state.notifications,
          exportedAt: new Date().toISOString(),
        };
      },

      importSettings: (settings) => {
        if (settings.fmsThresholds) {
          set({ fmsThresholds: settings.fmsThresholds });
        }
        if (settings.general) {
          set({ general: settings.general });
        }
        if (settings.mqtt) {
          set({ mqtt: settings.mqtt });
        }
        if (settings.notifications) {
          set({ notifications: settings.notifications });
        }
      },
    }),
    {
      name: "settings-storage",
      partialize: (state) => ({
        otaBasePath: state.otaBasePath,
        fmsThresholds: state.fmsThresholds,
        account: state.account,
        general: state.general,
        mqtt: state.mqtt,
        notifications: state.notifications,
      }),
    }
  )
);