// src/components/devices/RegisterDeviceModal.jsx
import { useState } from "react";
import Modal from "../common/Modal";
import { deviceDb } from "../../dbms/deviceDb";
import { checkDuplication } from "../../utils/utils";

export default function RegisterDeviceModal({ open, onClose, onDone }) {
  // ✅ useState를 사용하는 이유:
  // 1. React의 제어 컴포넌트(Controlled Component)로 만들기 위해
  //    - 입력값을 state로 관리해야 React가 값의 변화를 감지하고 리렌더링
  //    - 폼 유효성 검사, 값 정규화(trim, toUpperCase 등) 등을 쉽게 처리 가능
  // 2. busy: 비동기 작업 중 중복 제출 방지 및 로딩 UI 표시
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [gateway, setGateway] = useState("");
  const [dns, setDns] = useState("");
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
      
      // 옵션 필드는 값이 있을 때만 포함
      const deviceData = {
        serial: serialNorm,
        model: modelNorm || null,
        registeredAt,
        ...(latitude.trim() && { latitude: parseFloat(latitude.trim()) }),
        ...(longitude.trim() && { longitude: parseFloat(longitude.trim()) }),
        ...(ipv4.trim() && { ipv4: ipv4.trim() }),
        ...(ipv6.trim() && { ipv6: ipv6.trim() }),
        ...(gateway.trim() && { gateway: gateway.trim() }),
        ...(dns.trim() && { dns: dns.trim() }),
      };

      await deviceDb.devices.add(deviceData);

      alert("디바이스 등록 완료");
      onDone?.();
      onClose?.();
    } catch (err) {
      if (err?.name === "ConstraintError") {
        alert("이미 등록된 장비입니다. 동일한 Serial 이 존재합니다.");
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
      iconSrc="/icons/Btn_AddDevice_Nor.png"
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
            form="register-device-form"
            type="submit"
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white"
            disabled={busy}
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      }
    >
      <form id="register-device-form" onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="예: K8QR2A2V10001"
              className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
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
              className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
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
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
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
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
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
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">IPv6</label>
              <input
                type="text"
                value={ipv6}
                onChange={(e) => setIpv6(e.target.value)}
                placeholder="예: 2001:0db8::1"
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">게이트웨이</label>
              <input
                type="text"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                placeholder="예: 192.168.1.1"
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">DNS</label>
              <input
                type="text"
                value={dns}
                onChange={(e) => setDns(e.target.value)}
                placeholder="예: 8.8.8.8"
                className="w-full px-3 py-2 rounded bg-slate-800 text-slate-100 border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}