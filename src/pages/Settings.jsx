// src/pages/Settings.jsx
import React, { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/SettingsStore";
import { Card } from "../components/common/Card";
import { 
  uploadOtaPackageZip, 
  uploadOtaPackageFromFiles,
  clearOtaPackages 
} from "../services/ota/otaPackageService";
import { getDbStats, getAllPackages } from "../dbms/otaDb";
import { loadLocalIndex } from "../services/ota/otaService";

/**
 * 탭 컴포넌트
 */
function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex border-b border-slate-700 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {tab.label}
          {tab.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Settings 메인 페이지
 */
export default function Settings() {
  const [activeTab, setActiveTab] = useState("ota");

  const tabs = [
    { id: "ota", label: "OTA 업데이트" },
    { id: "fms", label: "FMS 임계값" },
    { id: "account", label: "계정 설정" },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">설정</h1>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="h-[calc(100vh-20rem)] max-h-[600px] overflow-y-auto">
        {activeTab === "ota" && <OtaSettingsTab />}
        {activeTab === "fms" && <FmsThresholdsTab />}
        {activeTab === "account" && <AccountSettingsTab />}
      </div>
    </Card>
  );
}

/* ==================== OTA 설정 탭 ==================== */
function OtaSettingsTab() {
  const [dbStats, setDbStats] = useState(null);
  const [packages, setPackages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // DB 상태 로드
  async function loadDbStatus() {
    setIsLoading(true);
    try {
      const stats = await getDbStats();
      const pkgs = await getAllPackages();
      setDbStats(stats);
      setPackages(pkgs);
    } catch (error) {
      console.error("Failed to load DB stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 컴포넌트 마운트 시 DB 상태 로드
  useEffect(() => {
    loadDbStatus();
  }, []);

  /**
   * ZIP 파일 업로드
   */
  async function handleUploadZip() {
    try {
      // 파일 선택
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);

        try {
          const result = await uploadOtaPackageZip(file);
          
          alert(
            `업로드 완료!\n\n` +
            `전체: ${result.total}개\n` +
            `신규: ${result.uploaded}개\n` +
            `업데이트: ${result.updated}개\n` +
            `스킵: ${result.skipped}개`
          );

          // DB 상태 새로고침
          await loadDbStatus();
          
          // OTA 스토어에 index 로드
          await loadLocalIndex();
        } catch (error) {
          console.error("Upload failed:", error);
          alert(`업로드 실패:\n${error.message}`);
        } finally {
          setIsUploading(false);
        }
      };

      input.click();
    } catch (error) {
      console.error("Failed to open file picker:", error);
      alert(`파일 선택 실패: ${error.message}`);
    }
  }

  /**
   * 폴더에서 업로드 (웹 환경)
   */
  async function handleUploadFolder() {
    try {
      // 폴더 선택 (webkitdirectory)
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.multiple = true;
      
      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsUploading(true);

        try {
          const result = await uploadOtaPackageFromFiles(files);
          
          alert(
            `업로드 완료!\n\n` +
            `전체: ${result.total}개\n` +
            `신규: ${result.uploaded}개\n` +
            `업데이트: ${result.updated}개\n` +
            `스킵: ${result.skipped}개`
          );

          // DB 상태 새로고침
          await loadDbStatus();
          
          // OTA 스토어에 index 로드
          await loadLocalIndex();
        } catch (error) {
          console.error("Upload failed:", error);
          alert(`업로드 실패:\n${error.message}`);
        } finally {
          setIsUploading(false);
        }
      };

      input.click();
    } catch (error) {
      console.error("Failed to open folder picker:", error);
      alert(`폴더 선택 실패: ${error.message}`);
    }
  }

  /**
   * 모든 패키지 삭제
   */
  async function handleClearPackages() {
    if (!window.confirm(
      "⚠️ 모든 OTA 패키지를 삭제하시겠습니까?\n\n" +
      "이 작업은 되돌릴 수 없습니다."
    )) {
      return;
    }

    try {
      await clearOtaPackages();
      alert("모든 패키지가 삭제되었습니다.");
      await loadDbStatus();
    } catch (error) {
      console.error("Failed to clear packages:", error);
      alert(`삭제 실패: ${error.message}`);
    }
  }

  /**
   * 파일 크기 포맷
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  return (
    <div className="space-y-6 bg-[#122033]/80">
      {/* 패키지 업로드 섹션 */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          OTA 패키지 업로드
        </h2>

        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            RSE 장치에 배포할 업데이트 패키지를 업로드하세요.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={handleUploadZip}
              disabled={isUploading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>{isUploading ? "업로드 중..." : "ZIP 파일 업로드"}</span>
            </button>

            <button
              onClick={handleUploadFolder}
              disabled={isUploading}
              className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>{isUploading ? "업로드 중..." : "폴더 선택"}</span>
            </button>
          </div>

          {isUploading && (
            <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-blue-300">
                  패키지를 업로드하고 있습니다...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DB 상태 섹션 */}
      <div className="border-t border-slate-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">
            저장된 패키지
          </h2>
          <button
            onClick={loadDbStatus}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? "로딩 중..." : "새로고침"}
          </button>
        </div>

        {dbStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">총 패키지</div>
              <div className="text-2xl font-bold text-slate-200">
                {dbStats.packageCount}개
              </div>
            </div>
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">총 용량</div>
              <div className="text-2xl font-bold text-slate-200">
                {formatFileSize(dbStats.totalSize)}
              </div>
            </div>
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">상태</div>
              <div className="text-2xl font-bold text-green-400">
                {dbStats.packageCount > 0 ? "✓ 준비됨" : "⚠ 없음"}
              </div>
            </div>
          </div>
        )}

        {/* 패키지 목록 */}
        {packages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">패키지 목록</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {packages.map((pkg) => (
                <div
                  key={pkg.sw_id}
                  className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm text-slate-200">
                          {pkg.sw_id}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">
                          v{pkg.version}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatFileSize(Math.round((pkg.data_base64?.length || 0) * 0.75))} • 
                        {" "}업로드: {new Date(pkg.updated_at).toLocaleString("ko-KR")}
                      </div>
                      {pkg.sw_md5 && (
                        <div className="mt-1 text-xs font-mono text-slate-500">
                          MD5: {pkg.sw_md5.substring(0, 16)}...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {packages.length === 0 && !isLoading && (
          <div className="p-8 text-center bg-slate-800/20 border border-slate-700/50 rounded-lg">
            <div className="text-sm text-slate-400">
              저장된 패키지가 없습니다.
              <br />
              위의 업로드 버튼을 사용하여 패키지를 추가하세요.
            </div>
          </div>
        )}

        {/* 삭제 버튼 */}
        {packages.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleClearPackages}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg transition-colors"
            >
              모든 패키지 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== FMS 임계값 탭 ==================== */
function FmsThresholdsTab() {
  const fmsThresholds = useSettingsStore((s) => s.fmsThresholds);
  const setFmsThreshold = useSettingsStore((s) => s.setFmsThreshold);
  const resetFmsThresholds = useSettingsStore((s) => s.resetFmsThresholds);

  const categories = [
    {
      key: "cpu",
      label: "CPU 사용률",
      description: "프로세서 사용률",
      unit: "%",
    },
    {
      key: "memory",
      label: "메모리 사용률",
      description: "RAM 사용률",
      unit: "%",
    },
    {
      key: "disk",
      label: "디스크 사용률",
      description: "eMMC/Storage 사용률",
      unit: "%",
    },
    {
      key: "temperature",
      label: "온도",
      description: "시스템 온도",
      unit: "°C",
    },
    {
      key: "rssi",
      label: "신호 세기 (RSSI)",
      description: "무선 신호 강도",
      unit: "dBm",
    },
    {
      key: "certificateDays",
      label: "인증서 만료",
      description: "인증서 만료까지 남은 일수",
      unit: "일",
    },
  ];

  function handleReset() {
    if (window.confirm("모든 임계값을 기본값으로 초기화하시겠습니까?")) {
      resetFmsThresholds();
      alert("임계값이 초기화되었습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-1">
            FMS 임계값 설정
          </h2>
          <p className="text-sm text-slate-400">
            장치 상태 모니터링을 위한 경고 및 위험 임계값을 설정하세요
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
        >
          초기화
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((category) => (
          <ThresholdCard
            key={category.key}
            category={category}
            values={fmsThresholds[category.key]}
            onChange={(level, value) =>
              setFmsThreshold(category.key, level, value)
            }
          />
        ))}
      </div>

      <div className="p-4 bg-amber-900/20 border border-amber-700/30 rounded-lg">
        <h3 className="text-sm font-semibold text-amber-300 mb-2">
          ⚠️ 임계값 설정 안내
        </h3>
        <ul className="text-xs text-slate-300 space-y-1">
          <li>• <strong>Warning (경고):</strong> 주의가 필요한 수준 (노란색)</li>
          <li>• <strong>Critical (위험):</strong> 즉시 조치가 필요한 수준 (빨간색)</li>
          <li>• Critical 값은 Warning 값보다 높게 설정해야 합니다</li>
          <li>• RSSI는 음수 값이므로 Warning이 Critical보다 높은 값입니다</li>
        </ul>
      </div>
    </div>
  );
}

function ThresholdCard({ category, values, onChange }) {
  const [warning, setWarning] = useState(values.warning);
  const [critical, setCritical] = useState(values.critical);

  function handleWarningChange(value) {
    const numValue = Number(value);
    setWarning(numValue);
    onChange("warning", numValue);
  }

  function handleCriticalChange(value) {
    const numValue = Number(value);
    setCritical(numValue);
    onChange("critical", numValue);
  }

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{category.label}</h3>
        <p className="text-xs text-slate-400 mt-1">{category.description}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-amber-400 mb-1">
            경고 (Warning)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={warning}
              onChange={(e) => handleWarningChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-400">{category.unit}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-red-400 mb-1">
            위험 (Critical)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={critical}
              onChange={(e) => handleCriticalChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="text-sm text-slate-400">{category.unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== 계정 설정 탭 ==================== */
function AccountSettingsTab() {
  const account = useSettingsStore((s) => s.account);
  const setAccountInfo = useSettingsStore((s) => s.setAccountInfo);

  const [username, setUsername] = useState(account.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSave() {
    setAccountInfo({ username });
    alert("계정 정보가 저장되었습니다.");
  }

  function handlePasswordChange() {
    if (!currentPassword) {
      alert("현재 비밀번호를 입력하세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 8) {
      alert("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    // TODO: 실제 비밀번호 변경 로직
    alert("비밀번호가 변경되었습니다.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">계정 정보</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              사용자 이름
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full md:w-96 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {account.lastLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                마지막 로그인
              </label>
              <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 w-full md:w-96">
                {new Date(account.lastLogin).toLocaleString("ko-KR")}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          비밀번호 변경
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full md:w-96 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full md:w-96 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">최소 8자 이상</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full md:w-96 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handlePasswordChange}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            비밀번호 변경
          </button>
        </div>
      </div>
    </div>
  );
}