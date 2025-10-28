// src/components/OtaUpdateManager.jsx
import { useEffect } from "react";
import { useOtaStore } from "../stores/OtaStore";
import { useInspectStore } from "../stores/InspectStore";
import { 
  loadLocalIndex, 
} from "../services/ota/otaService";

/**
 * OTA 업데이트 관리 컴포넌트
 */
export default function OtaUpdateManager() {
  const phase = useInspectStore((s) => s.phase);
  const isUpdating = useOtaStore((s) => s.isUpdating);
  const availableUpdates = useOtaStore((s) => s.availableUpdates);
  
  // 컴포넌트 마운트 시 index.json 로드
  useEffect(() => {
    loadLocalIndex().catch((error) => {
      console.error("Failed to load local index:", error);
    });
  }, []);

  // UI는 상태만 표시 (실제 업데이트는 자동으로 진행)
  if (phase !== "running") {
    return null;
  }
  
  const updateCount = Object.values(availableUpdates).reduce(
    (sum, updates) => sum + (updates?.length || 0), 
    0
  );
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isUpdating && (
        <div className="bg-blue-900/90 text-white px-4 py-3 rounded-lg shadow-lg border border-blue-500/50">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="font-medium">업데이트 진행 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}