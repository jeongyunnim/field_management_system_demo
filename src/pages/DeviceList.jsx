// src/pages/DeviceList.jsx
import { useEffect, useState, useCallback } from "react";
import { deviceDb } from "../dbms/deviceDb";
import { Card } from "../components/common/Card";
import { ZoomIn, Trash2 as Trash, RefreshCcw as Sync, Pencil } from "lucide-react";
import RegisterDeviceModal from "../components/devices/RegisterDeviceModal";
import EditDeviceModal from "../components/devices/EditDeviceModal";

export default function DeviceList({ setActivePage, embed = false }) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  // 모달 상태
  const [openRegister, setOpenRegister] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const all = await deviceDb.devices.toArray();
      setDevices(all);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  function handleEdit(id) {
    setEditTargetId(id);
  }

  function handleZoom(dev) {
    const label = dev.serial ?? dev.model ?? dev.id;
    alert(`위치 보기: ${label}`);
  }

  function handleSync(dev) {
    const label = dev.serial ?? dev.model ?? dev.id;
    alert(`상태 동기화: ${label}`);
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === devices.length) return new Set();
      return new Set(devices.map((d) => d.id));
    });
  }

  const allChecked = devices.length > 0 && selected.size === devices.length;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <>
      <Card className="h-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="main-card-title tracking-tight">등록 기기</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert("엑셀 등록 기능 준비 중")}
            >
              <img className="size-10" src="/public/icons/Btn_DocUpload_Nor.png" alt="엑셀 등록" />
            </button>
            <button
              onClick={() => setOpenRegister(true)}
            >
              <img className="size-10" src="/public/icons/Btn_AddDevice_Nor.png" alt="Rse 추가" />
            </button>
            <button
              onClick={async () => {
                  if (selected.size > 0) {
                    const ok = window.confirm(`${selected.size}개 삭제할까요?`);
                    if (!ok) return;
                    await Promise.all([...selected].map((id) => deviceDb.devices.delete(id)));
                    await loadDevices();
                  }
                  else 
                  {
                    alert("삭제할 항목을 선택해주세요");
                  }
                }}
                title="선택 삭제"
            >
              <img className="size-10" src="/public/icons/Btn_Delete_Nor.png" alt="선택 삭제" />
            </button>
          </div>
        </div>

        <div className="relative rounded-xl ring-1 ring-white/10 overflow-hidden bg-[#0f172a]">
          <table className="w-full border-collapse">
            <thead className="bg-[#1a273a] text-slate-200">
              <tr className="text-left">
                <Th className="w-12">
                  <label className="inline-flex items-center select-none">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked;
                      }}
                      onChange={toggleAll}
                      className="h-5 w-5 mt-1 accent-emerald-500"
                    />
                    <span className="hidden md:inline"></span>
                  </label>
                </Th>
                <Th>Serial</Th>
                <Th>모델명</Th>
                <Th>등록일시</Th>
                <Th className="w-[180px]">작업</Th>
              </tr>
            </thead>
            <tbody className="text-slate-200/90">
              {devices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {loading ? "불러오는 중..." : "등록된 장치가 없습니다."}
                  </td>
                </tr>
              )}
              {devices.map((dev) => (
                <tr
                  key={dev.id}
                  className="odd:bg-slate-800/20 even:bg-transparent hover:bg-slate-700/20 transition-colors border-t border-white/5"
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(dev.id)}
                      onChange={() => toggleRow(dev.id)}
                      className="h-5 w-5 accent-emerald-500"
                      aria-label={`${dev.serial} 선택`}
                    />
                  </Td>
                  <Td className="font-mono">{dev.serial ?? "-"}</Td>
                  <Td className="font-mono text-sm">{dev.model ?? "-"}</Td>
                  <Td className="text-sm">{dev.registeredAt ? new Date(dev.registeredAt).toLocaleString() : "-"}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <IconBtn title="상세보기" onClick={() => handleZoom(dev)}>
                        <ZoomIn size={18} />
                      </IconBtn>
                      <IconBtn title="상태 동기화" onClick={() => handleSync(dev)}>
                        <Sync size={18} />
                      </IconBtn>
                      <IconBtn title="수정" onClick={() => handleEdit(dev.id)}>
                        <Pencil size={18} />
                      </IconBtn>
                      
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 모달들 */}
      <RegisterDeviceModal
        open={openRegister}
        onClose={() => setOpenRegister(false)}
        onDone={loadDevices}
      />
      <EditDeviceModal
        open={!!editTargetId}
        deviceId={editTargetId}
        onClose={() => setEditTargetId(null)}
        onDone={loadDevices}
      />
    </>
  );
}

function Th({ className = "", children }) {
  return (
    <th className={["px-4 py-3 text-sm tracking-wide font-semibold", className].join(" ")}>
      {children}
    </th>
  );
}

function Td({ className = "", children }) {
  return <td className={["px-4 py-3 align-middle", className].join(" ")}>{children}</td>;
}

function IconBtn({ className = "", title, onClick, children }) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center px-2.5 py-1.5 rounded-md",
        "bg-slate-600/70 text-white",
        "ring-1 ring-white/10 transition-colors",
        className,
      ].join(" ")}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
