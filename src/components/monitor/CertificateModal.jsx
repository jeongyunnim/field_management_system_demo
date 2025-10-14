import { X, ShieldCheck } from "lucide-react";

// 1970 / 2004 epoch 자동 판별
function epochSecToDateAuto(sec) {
  if (!Number.isFinite(sec)) return null;
  const base2004 = Date.UTC(2004, 0, 1);
  const d1970 = new Date(sec * 1000);
  const d2004 = new Date(base2004 + sec * 1000);
  const now = Date.now();
  const inReason = (d) => d.getFullYear() >= 2004 && d.getFullYear() <= 2100;
  return inReason(d2004) && Math.abs(d2004 - now) <= Math.abs(d1970 - now) ? d2004 : d1970;
}

function fmt(dt) {
  return dt ? new Date(dt).toLocaleString() : "정보 없음";
}

export default function CertificateModal({ open, onClose, certificate, certDaysLeft }) {
  if (!open) return null;

  const enabled = !!certificate?.ltev2x_cert_status_security_enable;
  const start = epochSecToDateAuto(Number(certificate?.ltev2x_cert_valid_start));
  const end = epochSecToDateAuto(Number(certificate?.ltev2x_cert_valid_end));
  const ddayText = Number.isFinite(certDaysLeft)
    ? (certDaysLeft >= 0 ? `D-${certDaysLeft}` : `만료 ${-certDaysLeft}일`)
    : "정보 없음";

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-slate-100 font-semibold flex items-center gap-2">
              <ShieldCheck size={18} />
              인증서 정보
            </h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="닫기">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3 text-sm text-slate-200">
            <div className="grid grid-cols-3 gap-y-2">
              <div className="text-slate-400">보안 기능</div>
              <div className="col-span-2">{enabled ? "활성화" : "비활성화"}</div>

              <div className="text-slate-400">유효 시작</div>
              <div className="col-span-2">{fmt(start)}</div>

              <div className="text-slate-400">유효 종료</div>
              <div className="col-span-2">{fmt(end)}</div>

              <div className="text-slate-400">만기</div>
              <div className="col-span-2">{ddayText}</div>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              * 유효 기간 epoch는 플랫폼 설정에 따라 1970 또는 2004 기준일 수 있습니다.
            </div>
          </div>

          <div className="px-4 py-3 border-t border-white/10 flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
