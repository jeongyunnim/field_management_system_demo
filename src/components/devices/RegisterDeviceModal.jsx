// src/components/devices/RegisterDeviceModal.jsx
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import Modal from "../common/Modal";
import { deviceDb } from "../../dbms/deviceDb";
import { checkDuplication } from "../../utils/utils";

export default function RegisterDeviceModal({ open, onClose, onDone }) {
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      const serialNorm = serial.trim().toUpperCase();
      const modelNorm = model.trim();

      if (!serialNorm) {
        alert("serial 번호를 입력해주세요.");
        return;
      }

      const { allow } = await checkDuplication({ serial: serialNorm });
      if (!allow) return;

      const registeredAt = new Date().toISOString();
      await deviceDb.devices.add({
        serial: serialNorm,
        model: modelNorm || null,
        registeredAt,
      });

      alert("디바이스 등록 완료");
      onDone?.(); // 목록 리프레시
      onClose?.();
    } catch (err) {
      if (err?.name === "ConstraintError") {
        alert("❌ 이미 등록된 장비입니다. 동일한 Serial 이 존재합니다.");
      } else {
        console.error("등록 실패:", err);
        alert("디바이스 등록 실패");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="신규 장치 등록"
      iconSrc="/public/icons/Btn_AddDevice_Nor.png"
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
            form="register-device-form"
            type="submit"
            className="px-3 py-1.5 rounded text-white"
            disabled={busy}
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      }
    >
      <form id="register-device-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">Serial</label>
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="예: K8QR2A2V10001"
            className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">모델</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="예: Smart-RSU"
            className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10"
          />
        </div>
      </form>
    </Modal>
  );
}
