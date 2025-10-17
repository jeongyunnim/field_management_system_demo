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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!deviceId) {
      setDevice(null);
      setSerial("");
      setModel("");
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

      await deviceDb.transaction("rw", deviceDb.devices, async () => {
        await deviceDb.devices.update(device.id, {
          serial: nextSerial,
          model: nextModel,
        });
      });

      if (nextSerial !== device.serial) {
        invalidateRegistrationCache(device.serial, nextSerial);
      }

      alert("디바이스 정보가 수정되었습니다.");
      onDone?.(); // 목록 리프레시
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
      maxWidth="max-w-lg"
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
        <div className="p-2 text-slate-300">⏳ 디바이스 정보를 불러오는 중...</div>
      ) : !device ? (
        <div className="p-2 text-slate-400">장치를 찾을 수 없습니다.</div>
      ) : (
        <form id="edit-device-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-200">Serial</label>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10"
            />
            {serial !== device.serial && (
              <p className="mt-1 text-xs text-slate-400">저장 시 Serial이 변경됩니다.</p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-200">모델</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10"
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
