// src/pages/DeviceList.jsx
import { useEffect, useState } from "react";
import { deviceDb } from "../dbms/device_db";
import { Card } from "../components/common/Card";
import { ZoomIn, Trash2 as Trash, RefreshCcw as Sync, Pencil } from "lucide-react";
import StationMapPanel from "../components/monitor/StationMapPanel";

export default function DeviceList({ setActivePage, embed = false }) {
  const [loading, setLoading] = useState(false);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [stationStatusMap, setStationStatusMap] = useState({});
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  async function loadDevices() {
    setLoading(true);
    try {
      const all = await deviceDb.devices.toArray();
      setDevices(all);
      setSelected(new Set()); // 목록 갱신 시 선택 초기화
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleDelete(id) {
    const ok = window.confirm("정말로 디바이스를 삭제하시겠습니까?");
    if (!ok) return;
    await deviceDb.devices.delete(id);
    await loadDevices();
  }

  function handleEdit(id) {
    sessionStorage.setItem("editDeviceId", id);
    setActivePage("EditDevice");
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

  const fmtCoord = (v) =>
    typeof v === "number"
      ? v.toFixed(6)
      : typeof v === "string" && !Number.isNaN(Number(v))
      ? Number(v).toFixed(6)
      : v ?? "-";

  return (
    <Card className="h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="main-card-title tracking-tight">등록 기기</h2>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              className="bg-rose-800/80 btn-sm btn-text-sm"
              onClick={async () => {
                const ok = window.confirm(`${selected.size}개 삭제할까요?`);
                if (!ok) return;
                await Promise.all([...selected].map((id) => deviceDb.devices.delete(id)));
                await loadDevices();
              }}
              title="선택 삭제"
            >
              선택 삭제 ({selected.size})
            </button>
          )}
          <button
            className="btn-sm btn-text-sm"
            onClick={() => setActivePage("RegisterDevice")}
          >
            신규 장치 등록
          </button>
          <button
            className="btn-sm btn-text-sm"
            onClick={() => alert("엑셀 등록 기능은 아직 준비 중입니다.")}
          >
            엑셀 등록
          </button>
        </div>
      </div>

      <div className="relative rounded-xl ring-1 ring-white/10 overflow-hidden bg-[#0f172a]">
        <table className="w-full border-collapse">
          <thead className="bg-[#1a273a] text-slate-200">
            <tr className="text-left">
              <Th className="w-14">
                <label className="inline-flex items-center gap-2 select-none">
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
                    aria-label={`${dev.serial ?? dev.model ?? dev.id} 선택`}
                  />
                </Td>
                <Td className="font-mono">{dev.serial ?? "-"}</Td>
                <Td>{dev.model ?? "-"}</Td>
                <Td>{dev.registeredAt ? new Date(dev.registeredAt).toLocaleString() : "-"}</Td>
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
                    <IconBtn title="삭제" onClick={() => handleDelete(dev.id)}>
                      <Trash size={18} />
                    </IconBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
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
