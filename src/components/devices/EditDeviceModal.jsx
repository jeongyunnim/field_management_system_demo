// src/components/devices/EditDeviceModal.jsx
import { useEffect, useState } from "react";
import Dexie from "dexie";
import { Pencil } from "lucide-react";
import Modal from "../common/Modal";
import { deviceDb, invalidateRegistrationCache } from "../../dbms/deviceDb";

export default function EditDeviceModal({ open, onClose, deviceId, onDone }) {
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState(null);
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [gateway, setGateway] = useState("");
  const [dns, setDns] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!deviceId) {
      setDevice(null);
      setSerial("");
      setModel("");
      setLatitude("");
      setLongitude("");
      setIpv4("");
      setIpv6("");
      setGateway("");
      setDns("");
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const found = await deviceDb.devices.get(deviceId);
        if (!found) {
          alert("디바이스를 찾을 수 없습니다.");
          onClose?.();
          return;
        }
        setDevice(found);
        setSerial(found.serial ?? "");
        setModel(found.model ?? "");
        setLatitude(found.latitude != null ? String(found.latitude) : "");
        setLongitude(found.longitude != null ? String(found.longitude) : "");
        setIpv4(found.ipv4 ?? "");
        setIpv6(found.ipv6 ?? "");
        setGateway(found.gateway ?? "");
        setDns(found.dns ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, deviceId, onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (busy || !device) return;
    setBusy(true);

    const nextSerial = (serial ?? "").trim();
    const nextModel = (model ?? "").trim();

    if (!nextSerial) {
      alert("Serial은 비워둘 수 없습니다.");
      setBusy(false);
      return;
    }

    try {
      // serial 변경 시 중복 검사
      if (nextSerial !== device.serial) {
        const dup = await deviceDb.devices.where("serial").equals(nextSerial).first();
        if (dup && dup.id !== device.id) {
          alert(`이미 등록된 Serial 입니다: ${nextSerial}`);
          setBusy(false);
          return;
        }
      }

      // 업데이트할 데이터 구성 (옵션 필드는 값이 있을 때만 포함)
      const updateData = {
        serial: nextSerial,
        model: nextModel,
      };

      // 위도/경도는 값이 있으면 숫자로 변환, 없으면 null
      if (latitude.trim()) {
        updateData.latitude = parseFloat(latitude.trim());
      } else {
        updateData.latitude = null;
      }

      if (longitude.trim()) {
        updateData.longitude = parseFloat(longitude.trim());
      } else {
        updateData.longitude = null;
      }

      // 네트워크 정보는 값이 있으면 문자열, 없으면 null
      updateData.ipv4 = ipv4.trim() || null;
      updateData.ipv6 = ipv6.trim() || null;
      updateData.gateway = gateway.trim() || null;
      updateData.dns = dns.trim() || null;

      await deviceDb.transaction("rw", deviceDb.devices, async () => {
        await deviceDb.devices.update(device.id, updateData);
      });

      if (nextSerial !== device.serial) {
        invalidateRegistrationCache(device.serial, nextSerial);
      }

      alert("디바이스 정보가 수정되었습니다.");
      onDone?.();
      onClose?.();
    } catch (e2) {
      if (e2 instanceof Dexie.ConstraintError) {
        alert("Serial 중복으로 저장할 수 없습니다.");
      } else {
        console.error(e2);
        alert("저장 중 오류가 발생했습니다.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="디바이스 수정"
      icon={<Pencil size={18} />}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
            onClick={onClose}
            disabled={busy}
          >
            취소
          </button>
          <button
            form="edit-device-form"
            type="submit"
            className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white"
            disabled={busy || loading || !device}
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="p-2 text-slate-300">디바이스 정보를 불러오는 중...</div>
      ) : !device ? (
        <div className="p-2 text-slate-400">장치를 찾을 수 없습니다.</div>
      ) : (
        <form id="edit-device-form" onSubmit={handleSave} className="space-y-4">
          {/* 필수 필드 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Serial <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                required
              />
              {serial !== device.serial && (
                <p className="mt-1 text-xs text-slate-400">저장 시 Serial이 변경됩니다.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">모델</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 위치 정보 */}
          <div className="pt-2 border-t border-white/10">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">위치 정보 (선택)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">위도</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="예: 37.5665"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">경도</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="예: 126.9780"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 네트워크 정보 */}
          <div className="pt-2 border-t border-white/10">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">네트워크 정보 (선택)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">IPv4</label>
                <input
                  type="text"
                  value={ipv4}
                  onChange={(e) => setIpv4(e.target.value)}
                  placeholder="예: 192.168.1.100"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">IPv6</label>
                <input
                  type="text"
                  value={ipv6}
                  onChange={(e) => setIpv6(e.target.value)}
                  placeholder="예: 2001:0db8::1"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">게이트웨이</label>
                <input
                  type="text"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="예: 192.168.1.1"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">DNS</label>
                <input
                  type="text"
                  value={dns}
                  onChange={(e) => setDns(e.target.value)}
                  placeholder="예: 8.8.8.8"
                  className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}