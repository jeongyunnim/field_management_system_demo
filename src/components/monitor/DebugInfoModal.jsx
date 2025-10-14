import { useState } from "react";
import { X, FileDown, ChevronDown, ChevronRight } from "lucide-react";

// 1970/2004 epoch 자동 판별
function epochSecToDateAuto(sec) {
  if (!Number.isFinite(sec)) return null;
  const base2004 = Date.UTC(2004, 0, 1);
  const d1970 = new Date(sec * 1000);
  const d2004 = new Date(base2004 + sec * 1000);
  const now = Date.now();
  const inReason = (d) => d.getFullYear() >= 2004 && d.getFullYear() <= 2100;
  return inReason(d2004) && Math.abs(d2004 - now) <= Math.abs(d1970 - now) ? d2004 : d1970;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleString() : "정보 없음";
}

function kv(label, value) {
  return (
    <div className="grid grid-cols-3 gap-y-1">
      <div className="text-slate-400">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}

export default function DebugInfoModal({ open, onClose, selected }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!open) return null;

  // 안전 추출
  const serial = selected?.serial ?? selected?.id ?? "—";
  const active = !!selected?.active;

  const rssiDbm = Number.isFinite(selected?.rssiDbm) ? selected.rssiDbm : null;
  const bars = Number.isFinite(selected?.bars) ? selected.bars : 0;

  const h = selected?.health;
  const healthPct =
    h && typeof h === "object"
      ? Number(h.healthPct ?? h.pct ?? 0)
      : (Number.isFinite(h) ? Number(h) : 0);
  const issues = Array.isArray(h?.issues) ? h.issues : [];

  const flags = h?.flags && typeof h.flags === "object" ? h.flags : null;
  const failedFlags = flags
    ? Object.entries(flags).filter(([_, v]) => v === false).map(([k]) => k)
    : [];

  const cpu = Number.isFinite(selected?.cpuTotalPct) ? `${selected.cpuTotalPct.toFixed(3)}%` : "—";
  const mem = Number.isFinite(selected?.memUsedPct) ? `${selected.memUsedPct.toFixed(3)}%` : "—";
  const disk = Number.isFinite(selected?.diskUsedPct) ? `${selected.diskUsedPct.toFixed(3)}%` : "—";
  const temp = Number.isFinite(selected?.temperatureC) ? `${selected.temperatureC} ℃` : "—";

  const coords = selected?.coords && Number.isFinite(selected.coords.lat) && Number.isFinite(selected.coords.lon)
    ? `${selected.coords.lat.toFixed(6)}, ${selected.coords.lon.toFixed(6)}`
    : "—";

  const updated = selected?.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—";

  const cert = selected?.__raw?.certificate ?? selected?.certificate ?? null;
  const certEnabled = !!cert?.ltev2x_cert_status_security_enable;
  const certStart = fmtDate(epochSecToDateAuto(Number(cert?.ltev2x_cert_valid_start)));
  const certEnd = fmtDate(epochSecToDateAuto(Number(cert?.ltev2x_cert_valid_end)));
  const dday = Number.isFinite(selected?.certDaysLeft)
    ? (selected.certDaysLeft >= 0 ? `D-${selected.certDaysLeft}` : `만료 ${-selected.certDaysLeft}일`)
    : "정보 없음";

  const handleDownload = () => {
    try {
      const blob = new Blob([JSON.stringify(selected ?? {}, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debug_${serial}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("download failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-[#0f172a] ring-1 ring-white/10 shadow-xl overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-slate-100 font-semibold">디버그 정보</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs"
                title="JSON 다운로드"
              >
                <FileDown size={16} />
                JSON 저장
              </button>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="닫기">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 본문: 요약 카드식 */}
          <div className="p-4 grid grid-cols-2 overflow-y-auto gap-4 text-sm text-slate-200">
            {/* 기본 정보 */}
            <div className="col-span-2 md:col-span-1 rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2">
              <div className="font-semibold text-slate-100">기본</div>
              {kv("시리얼", serial)}
              {kv("상태", active ? "Active" : "Inactive")}
              {kv("최종 갱신", updated)}
            </div>

            {/* 신호/위치 */}
            <div className="col-span-2 md:col-span-1 rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2">
              <div className="font-semibold text-slate-100">신호 / 위치</div>
              {kv("RSSI(dBm)", rssiDbm != null ? `${rssiDbm} dBm` : "—")}
              {kv("Bars", bars)}
              {kv("좌표", coords)}
            </div>

            {/* Health */}
            <div className="col-span-2 md:col-span-1 rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2">
              <div className="font-semibold text-slate-100">Health</div>
              {kv("정상 비율", `${healthPct}%`)}
              {kv("이슈 개수", String(issues.length || failedFlags.length))}
              {(issues.length > 0 || failedFlags.length > 0) && (
                <div className="mt-1">
                  <div className="text-slate-400 mb-1">비정상 항목</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(issues.length ? issues : failedFlags).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 리소스 */}
            <div className="col-span-2 md:col-span-1 rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2">
              <div className="font-semibold text-slate-100">시스템 리소스</div>
              {kv("CPU 사용률", cpu)}
              {kv("메모리 사용률", mem)}
              {kv("스토리지 사용률", disk)}
              {kv("온도", temp)}
            </div>

            {/* 인증서 */}
            <div className="col-span-2 rounded-xl bg-[#0b1524] ring-1 ring-white/10 p-3 space-y-2">
              <div className="font-semibold text-slate-100">인증서</div>
              {kv("보안 기능", cert ? (certEnabled ? "활성화" : "비활성화") : "정보 없음")}
              {kv("유효 시작", cert ? certStart : "정보 없음")}
              {kv("유효 종료", cert ? certEnd : "정보 없음")}
              {kv("만기", dday)}
              <div className="text-slate-400 text-xs mt-1">
                * 유효 기간 epoch는 플랫폼 설정에 따라 1970 또는 2004 기준일 수 있습니다.
              </div>
            </div>
            {/* 원본(자세히) 토글 */}
            <div className="col-span-2">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded ring-1 ring-white/10 bg-slate-700/40 hover:bg-slate-700/50 text-xs"
                aria-expanded={showRaw}
              >
                {showRaw ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                자세히(원본 JSON)
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-24 overflow-auto text-xs whitespace-pre-wrap bg-black/30 rounded p-3">
                  {JSON.stringify(selected.__raw ?? {}, null, 2)}
                </pre>
              )}
            </div>

          </div>

          {/* 푸터 */}
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
