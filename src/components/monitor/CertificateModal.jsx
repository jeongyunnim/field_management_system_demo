import { X, ShieldCheck } from "lucide-react";
import { rpcDirect } from "../../services/mqtt/directPool";
import { epochSecToDateAuto } from "../../utils/epochSecToDateAuto";
import { arrayBufferToBase64, generateTransactionId } from "../../utils/deviceUtils";
import { MQTT_TOPICS, TIMEOUTS } from "../../constants/appConstants";

/**
 * 인증서 번들 ZIP 파일 전송
 * @param {string|object} pktOrIp - 장치 IP 또는 패킷 객체
 * @param {string} base64Zip - Base64 인코딩된 ZIP 파일
 * @param {number} txId - 트랜잭션 ID
 * @returns {Promise<object>} 응답 객체
 */
async function uploadCertificateBundle(pktOrIp, base64Zip, txId) {
  const payload = {
    VER: "1.0",
    TRANSACTION_ID: txId,
    BUNDLE_CERT_DATA_BASE64: base64Zip,
  };

  const response = await rpcDirect({
    pktOrIp,
    reqTopic: MQTT_TOPICS.CERT_APPLY_REQ,
    resTopic: MQTT_TOPICS.CERT_APPLY_RES,
    payload,
    timeoutMs: TIMEOUTS.CERT_UPLOAD,
    match: (obj) => Number(obj?.CODE) === 200,
  });

  return response;
}

/**
 * 날짜 포맷팅
 * @param {Date|string|number} date - 포맷할 날짜
 * @returns {string} 포맷된 날짜 문자열
 */
function formatDate(date) {
  return date ? new Date(date).toLocaleString() : "정보 없음";
}

/**
 * 인증서 정보 모달
 */
export default function CertificateModal({ 
  open, 
  onClose, 
  certificate, 
  certDaysLeft, 
  pktOrIp 
}) {
  if (!open) return null;

  const enabled = !!certificate?.ltev2x_cert_status_security_enable;
  const validStart = epochSecToDateAuto(Number(certificate?.ltev2x_cert_valid_start));
  const validEnd = epochSecToDateAuto(Number(certificate?.ltev2x_cert_valid_end));
  
  const expiryText = Number.isFinite(certDaysLeft)
    ? certDaysLeft >= 0 
      ? `D-${certDaysLeft}`
      : `만료 ${-certDaysLeft}일`
    : "정보 없음";

  /**
   * 인증서 업로드 핸들러
   */
  async function handleUploadClick() {
    try {
      if (!pktOrIp) {
        alert("업로드 대상 정보가 없습니다.");
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      
      input.onchange = async (event) => {
        try {
          const file = event.target.files?.[0];
          if (!file) return;

          // 파일을 Base64로 변환
          const arrayBuffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const transactionId = generateTransactionId();

          // 인증서 업로드
          const response = await uploadCertificateBundle(pktOrIp, base64, transactionId);

          console.log("[Certificate Upload Response]", response);
          alert(
            `응답 CODE=${response?.CODE}, TX=${response?.TRANSACTION_ID}\n전송 성공`
          );
        } catch (error) {
          console.error("Certificate upload error:", error);
          alert(`업로드 실패: ${error?.message || error}`);
        } finally {
          // 같은 파일 재선택 허용
          if (event?.target) {
            try {
              event.target.value = "";
            } catch {}
          }
        }
      };

      input.click();
    } catch (error) {
      console.error("Upload preparation error:", error);
      alert(`업로드 준비 실패: ${error?.message || error}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      {/* 모달 컨테이너 */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden">
          
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-slate-100 font-semibold flex items-center gap-2">
              <ShieldCheck size={18} />
              인증서 정보
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>

          {/* 본문 */}
          <div className="p-4 space-y-3 text-sm text-slate-200">
            <div className="grid grid-cols-3 gap-y-2">
              <div className="text-slate-400">보안 기능</div>
              <div className="col-span-2">{enabled ? "활성화" : "비활성화"}</div>

              <div className="text-slate-400">유효 시작</div>
              <div className="col-span-2">{formatDate(validStart)}</div>

              <div className="text-slate-400">유효 종료</div>
              <div className="col-span-2">{formatDate(validEnd)}</div>

              <div className="text-slate-400">만기</div>
              <div className="col-span-2">{expiryText}</div>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              * 유효 기간 epoch는 플랫폼 설정에 따라 1970 또는 2004 기준일 수 있습니다.
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
            <button
              onClick={handleUploadClick}
              className="px-3 py-1.5 rounded bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors"
            >
              갱신 (업로드)
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}