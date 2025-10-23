// import { Card } from "../components/common/Card";

// export default function Settings() {
//   return (
//     <Card>
//       <h1 className="text-2xl">설정</h1>
//       <button className="btn">지도 권역 추가(업로드)</button>
//     </Card>
//   );
// }

// src/pages/Settings.jsx
import { useState } from "react";
import { useAuthStore } from "../stores/AuthStore";

export default function Settings() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-slate-100 mb-6">시스템 설정</h2>

        {/* 계정 설정 섹션 */}
        <div className="bg-[#1a2942] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            계정 설정
          </h3>

          <div className="space-y-6">
            <UserInfoSection />
            <div className="border-t border-slate-700 my-6" />
            <ChangeUsernameSection />
            <div className="border-t border-slate-700 my-6" />
            <ChangePasswordSection />
          </div>
        </div>

        {/* 시스템 설정 섹션 */}
        <div className="bg-[#1a2942] rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            시스템 관리
          </h3>
          <ResetCredentialsSection />
        </div>
      </div>
    </div>
  );
}

/**
 * 현재 사용자 정보 표시
 */
function UserInfoSection() {
  const currentUser = useAuthStore((s) => s.currentUser);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        현재 로그인된 사용자
      </label>
      <div className="flex items-center space-x-3 p-4 bg-[#0f1a2a] rounded-lg border border-slate-600">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
          {currentUser?.charAt(0).toUpperCase() || "A"}
        </div>
        <div>
          <p className="text-slate-100 font-medium">{currentUser || "Admin"}</p>
          <p className="text-slate-400 text-sm">관리자</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 사용자 이름 변경 섹션
 */
function ChangeUsernameSection() {
  const [password, setPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const changeUsername = useAuthStore((s) => s.changeUsername);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!password || !newUsername) {
      setMessage({ type: "error", text: "모든 필드를 입력해주세요." });
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result = changeUsername(password, newUsername);

    if (result.success) {
      setMessage({ type: "success", text: "사용자 이름이 변경되었습니다." });
      setPassword("");
      setNewUsername("");
    } else {
      setMessage({ type: "error", text: result.error });
    }

    setIsLoading(false);
  };

  return (
    <div>
      <h4 className="text-lg font-medium text-slate-100 mb-3">사용자 이름 변경</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            현재 비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="현재 비밀번호를 입력하세요"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            새 사용자 이름
          </label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="새 사용자 이름을 입력하세요 (3자 이상)"
            disabled={isLoading}
          />
        </div>

        {message.text && (
          <div
            className={`flex items-center space-x-2 text-sm rounded-lg p-3 ${
              message.type === "success"
                ? "text-green-400 bg-green-900/20 border border-green-800/50"
                : "text-red-400 bg-red-900/20 border border-red-800/50"
            }`}
          >
            {message.type === "success" ? (
              <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "변경 중..." : "사용자 이름 변경"}
        </button>
      </form>
    </div>
  );
}

/**
 * 비밀번호 변경 섹션
 */
function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const changePassword = useAuthStore((s) => s.changePassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "모든 필드를 입력해주세요." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result = changePassword(currentPassword, newPassword);

    if (result.success) {
      setMessage({ type: "success", text: "비밀번호가 변경되었습니다." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setMessage({ type: "error", text: result.error });
    }

    setIsLoading(false);
  };

  return (
    <div>
      <h4 className="text-lg font-medium text-slate-100 mb-3">비밀번호 변경</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            현재 비밀번호
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="현재 비밀번호를 입력하세요"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            새 비밀번호
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="새 비밀번호를 입력하세요 (6자 이상)"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            새 비밀번호 확인
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 bg-[#0f1a2a] border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="새 비밀번호를 다시 입력하세요"
            disabled={isLoading}
          />
        </div>

        {message.text && (
          <div
            className={`flex items-center space-x-2 text-sm rounded-lg p-3 ${
              message.type === "success"
                ? "text-green-400 bg-green-900/20 border border-green-800/50"
                : "text-red-400 bg-red-900/20 border border-red-800/50"
            }`}
          >
            {message.type === "success" ? (
              <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}

/**
 * 자격 증명 초기화 섹션
 */
function ResetCredentialsSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const resetCredentials = useAuthStore((s) => s.resetCredentials);

  const handleReset = () => {
    if (window.confirm("정말로 계정 정보를 초기화하시겠습니까?\n(admin / admin1234)")) {
      resetCredentials();
      alert("계정 정보가 초기화되었습니다.\n다시 로그인해주세요.");
    }
  };

  return (
    <div>
      <h4 className="text-lg font-medium text-slate-100 mb-3">계정 초기화</h4>
      <p className="text-slate-400 text-sm mb-4">
        계정 정보를 기본값(admin / admin1234)으로 초기화합니다.
        <br />
        초기화 후에는 자동으로 로그아웃됩니다.
      </p>
      <button
        onClick={handleReset}
        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
      >
        계정 초기화
      </button>
    </div>
  );
}