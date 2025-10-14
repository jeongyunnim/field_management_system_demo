import { X, AlertTriangle } from "lucide-react";

export default function HealthIssuesModal({ open, onClose, issues = [], title = "정상 상태가 아닌 항목" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-slate-100 font-semibold">{title}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="닫기">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 text-sm">
            {issues.length === 0 ? (
              <div className="text-emerald-300">모든 항목이 정상입니다.</div>
            ) : (
              <ul className="space-y-2">
                {issues.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5" size={16} />
                    <span className="text-slate-200">{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-slate-400 text-xs mt-4">* 항목은 장치가 보고한 상태를 바탕으로 계산됩니다.</p>
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
