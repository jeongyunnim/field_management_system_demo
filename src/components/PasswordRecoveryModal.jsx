// src/components/PasswordRecoveryModal.jsx (평문 버전)
import { useState } from "react";
import { useAuthStore } from "../stores/AuthStore";

export default function PasswordRecoveryModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: 확인, 2: 복구키 입력, 3: 성공
  const [recoveryKey, setRecoveryKey] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const resetCredentials = useAuthStore((s) => s.resetCredentials);

  if (!isOpen) return null;

  const handleReset = async () => {
    setError("");
    setIsProcessing(true);

    // 약간의 지연 (실제 검증하는 느낌)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 마스터 복구 키 검증
    const MASTER_RECOVERY_KEY = "DVT230904"; // 변경 가능
    
    if (recoveryKey.toUpperCase() === MASTER_RECOVERY_KEY) {
      // 복구 키 일치
      resetCredentials();
      setStep(3);
    } else {
      setError("복구 키가 올바르지 않습니다.");
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    setStep(1);
    setRecoveryKey("");
    setError("");
    onClose();
  };

  const handleFinish = () => {
    handleClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a2942] rounded-2xl shadow-2xl border border-slate-700/50 w-full max-w-md">
        {/* Step 1: 확인 */}
        {step === 1 && (
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-100 text-center mb-4">
              비밀번호를 잊으셨나요?
            </h2>

            <p className="text-slate-400 text-center mb-6">
              계정을 초기화하면 기본 계정(admin/admin1234)으로 되돌아갑니다.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                복구 키로 초기화
              </button>

              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-transparent hover:bg-slate-700/50 text-slate-400 font-medium rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 복구 키 입력 */}
        {step === 2 && (
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-100 text-center mb-4">
              복구 키 입력
            </h2>

            <p className="text-slate-400 text-center mb-6">
              시스템 관리자에게 문의하여 복구 키를 받으세요.
            </p>

            <div className="mb-4">
              <input
                type="text"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                className="block w-full px-4 py-3 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center tracking-wider font-mono"
                placeholder="복구 키 입력"
                disabled={isProcessing}
              />
            </div>

            {error && (
              <div className="mb-4 flex items-center space-x-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleReset}
                disabled={!recoveryKey || isProcessing}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "처리 중..." : "계정 초기화"}
              </button>

              <button
                onClick={() => setStep(1)}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-transparent hover:bg-slate-700/50 text-slate-400 font-medium rounded-lg transition-colors"
              >
                뒤로 가기
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 성공 */}
        {step === 3 && (
          <div className="p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-100 text-center mb-4">
              계정이 초기화되었습니다
            </h2>

            <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-center mb-3">
                다음 계정으로 로그인하세요:
              </p>
              <div className="space-y-2 text-center">
                <div>
                  <span className="text-slate-500">사용자 이름: </span>
                  <span className="text-blue-400 font-mono font-bold">admin</span>
                </div>
                <div>
                  <span className="text-slate-500">비밀번호: </span>
                  <span className="text-blue-400 font-mono font-bold">admin1234</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              확인
            </button>

            <p className="mt-4 text-xs text-slate-500 text-center">
              로그인 후 설정에서 비밀번호를 변경하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}