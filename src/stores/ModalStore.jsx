import { create } from "zustand";

/**
 * UI 모달 상태 관리 스토어
 * useState 대신 전역 상태로 관리하여 컴포넌트 간 상태 공유 용이
 */
export const useModalStore = create((set) => ({
  // 모달 열림 상태
  modals: {
    healthIssues: false,
    certificate: false,
    debug: false,
    detailedStats: false,
  },

  // 특정 모달 열기
  openModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: true },
    })),

  // 특정 모달 닫기
  closeModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: false },
    })),

  // 모든 모달 닫기
  closeAllModals: () =>
    set({
      modals: {
        healthIssues: false,
        certificate: false,
        debug: false,
        detailedStats: false,
      },
    }),

  // 모달 토글
  toggleModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: !state.modals[modalName] },
    })),
}));

/**
 * 디버그 정보 모달 전용 스토어
 */
export const useDebugModalStore = create((set) => ({
  // Raw JSON 표시 여부
  showRawJson: false,

  // Raw JSON 표시 토글
  toggleRawJson: () => set((state) => ({ showRawJson: !state.showRawJson })),

  // Raw JSON 표시 설정
  setShowRawJson: (show) => set({ showRawJson: !!show }),

  // 리셋
  reset: () => set({ showRawJson: false }),
}));