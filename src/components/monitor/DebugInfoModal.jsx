import { X, FileDown, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useDebugModalStore } from "../../stores/ModalStore";
import { epochSecToDateAuto } from "../../utils/epochSecToDateAuto";
import {
  formatDate,
  formatPercent,
  formatTemperature,
  formatCoordinates,
  formatRssi,
  formatCertExpiry,
  downloadJson,
  copyToClipboard,
  getHealthPercent,
  getFailedFlags,
} from "../../utils/formatUtils";

/**
 * 키-값 쌍 렌더링 헬퍼 컴포넌트
 */
function KeyValuePair({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-y-1">
      <div className="text-slate-400">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}

/**
 * 정보 카드 컴포넌트
 */
function InfoCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2 ${className}`}>
      <div className="font-semibold text-slate-100">{title}</div>
      {children}
    </div>
  );
}

/**
 * 디버그 정보 모달
 */
export default function DebugInfoModal({ open, onClose, selected }) {
  const showRawJson = useDebugModalStore((state) => state.showRawJson);
  const toggleRawJson = useDebugModalStore((state) => state.toggleRawJson);
  const resetDebugModal = useDebugModalStore((state) => state.reset);
  
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  // 모달 닫기 시 상태 리셋
  const handleClose = () => {
    resetDebugModal();
    onClose();
  };

  // JSON 다운로드
  const handleDownload = () => {
    const filename = `debug_${selected?.serial ?? selected?.id ?? "unknown"}.json`;
    const success = downloadJson(selected ?? {}, filename);
    
    if (!success) {
      alert("다운로드에 실패했습니다.");
    }
  };

  // JSON 클립보드 복사
  const handleCopyJson = async () => {
    const jsonString = JSON.stringify(selected?.__raw ?? {}, null, 2);
    const success = await copyToClipboard(jsonString);
    
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  // 기본 정보 추출
  const deviceInfo = extractDeviceInfo(selected);
  const signalInfo = extractSignalInfo(selected);
  const healthInfo = extractHealthInfo(selected);
  const resourceInfo = extractResourceInfo(selected);
  const certificateInfo = extractCertificateInfo(selected);

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* 모달 컨테이너 */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <h3 className="text-slate-100 font-semibold">디버그 정보</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs transition-colors"
                title="JSON 다운로드"
              >
                <FileDown size={16} />
                JSON 저장
              </button>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 본문: 요약 카드식 (스크롤 가능) */}
          <div className="p-4 grid grid-cols-2 overflow-y-auto gap-4 text-sm text-slate-200 flex-1">
            
            {/* 기본 정보 */}
            <InfoCard title="기본" className="col-span-2 md:col-span-1">
              <KeyValuePair label="시리얼" value={deviceInfo.serial} />
              <KeyValuePair label="상태" value={deviceInfo.status} />
              <KeyValuePair label="최종 갱신" value={deviceInfo.lastUpdate} />
            </InfoCard>

            {/* 신호/위치 */}
            <InfoCard title="신호 / 위치" className="col-span-2 md:col-span-1">
              <KeyValuePair label="RSSI(dBm)" value={signalInfo.rssi} />
              <KeyValuePair label="Bars" value={signalInfo.bars} />
              <KeyValuePair label="좌표" value={signalInfo.coordinates} />
            </InfoCard>

            {/* Health */}
            <InfoCard title="Health" className="col-span-2 md:col-span-1">
              <KeyValuePair label="정상 비율" value={healthInfo.percentage} />
              <KeyValuePair label="이슈 개수" value={healthInfo.issueCount} />
              {healthInfo.issues.length > 0 && (
                <div className="mt-1">
                  <div className="text-slate-400 mb-1">비정상 항목</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {healthInfo.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </InfoCard>

            {/* 리소스 */}
            <InfoCard title="시스템 리소스" className="col-span-2 md:col-span-1">
              <KeyValuePair label="CPU 사용률" value={resourceInfo.cpu} />
              <KeyValuePair label="메모리 사용률" value={resourceInfo.memory} />
              <KeyValuePair label="스토리지 사용률" value={resourceInfo.disk} />
              <KeyValuePair label="온도" value={resourceInfo.temperature} />
            </InfoCard>

            {/* 인증서 */}
            <InfoCard title="인증서" className="col-span-2">
              <KeyValuePair label="보안 기능" value={certificateInfo.status} />
              <KeyValuePair label="유효 시작" value={certificateInfo.validStart} />
              <KeyValuePair label="유효 종료" value={certificateInfo.validEnd} />
              <KeyValuePair label="만기" value={certificateInfo.expiry} />
              <div className="text-slate-400 text-xs mt-1">
                * 유효 기간 epoch는 플랫폼 설정에 따라 1970 또는 2004 기준일 수 있습니다.
              </div>
            </InfoCard>

            {/* 원본 JSON 토글 */}
            <div className="col-span-2">
              <button
                type="button"
                onClick={toggleRawJson}
                className="inline-flex items-center gap-1 px-2 py-1 rounded ring-1 ring-white/10 bg-slate-700/40 hover:bg-slate-700/50 text-xs transition-colors"
                aria-expanded={showRawJson}
              >
                {showRawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                자세히(원본 JSON)
              </button>
              
              {showRawJson && (
                <div className="mt-2 relative">
                  <button
                    onClick={handleCopyJson}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-700/80 hover:bg-slate-600/80 text-slate-100 transition-colors"
                    title="JSON 복사"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap bg-black/30 rounded p-3 pr-12">
                    {JSON.stringify(selected?.__raw ?? {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-4 py-3 border-t border-white/10 flex justify-end shrink-0">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================== 정보 추출 헬퍼 함수 ================== */

/**
 * 장치 기본 정보 추출
 */
function extractDeviceInfo(selected) {
  return {
    serial: selected?.serial ?? selected?.id ?? "—",
    status: selected?.active ? "Active" : "Inactive",
    lastUpdate: selected?.updatedAt 
      ? formatDate(selected.updatedAt)
      : "—",
  };
}

/**
 * 신호 및 위치 정보 추출
 */
function extractSignalInfo(selected) {
  return {
    rssi: formatRssi(selected?.rssiDbm),
    bars: String(Number.isFinite(selected?.bars) ? selected.bars : 0),
    coordinates: formatCoordinates(selected?.coords),
  };
}

/**
 * 헬스 정보 추출
 */
function extractHealthInfo(selected) {
  const health = selected?.health;
  const healthPercent = getHealthPercent(health);
  
  const issues = Array.isArray(health?.issues) && health.issues.length > 0
    ? health.issues
    : [];
  
  const failedFlags = getFailedFlags(health?.flags);
  const allIssues = issues.length > 0 ? issues : failedFlags;

  return {
    percentage: `${healthPercent}%`,
    issueCount: String(allIssues.length),
    issues: allIssues,
  };
}

/**
 * 시스템 리소스 정보 추출
 */
function extractResourceInfo(selected) {
  return {
    cpu: formatPercent(selected?.cpuTotalPct),
    memory: formatPercent(selected?.memUsedPct),
    disk: formatPercent(selected?.diskUsedPct),
    temperature: formatTemperature(selected?.temperatureC),
  };
}

/**
 * 인증서 정보 추출
 */
function extractCertificateInfo(selected) {
  const cert = selected?.__raw?.certificate ?? selected?.certificate ?? null;
  const certEnabled = !!cert?.ltev2x_cert_status_security_enable;
  
  return {
    status: cert 
      ? (certEnabled ? "활성화" : "비활성화")
      : "정보 없음",
    validStart: cert 
      ? formatDate(epochSecToDateAuto(Number(cert?.ltev2x_cert_valid_start)))
      : "정보 없음",
    validEnd: cert 
      ? formatDate(epochSecToDateAuto(Number(cert?.ltev2x_cert_valid_end)))
      : "정보 없음",
    expiry: formatCertExpiry(selected?.certDaysLeft),
  };
}