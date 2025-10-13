// pages/RegisterDevice.jsx
import { useState } from "react";
import { deviceDb } from "../dbms/deviceDb";
// ✅ 안 쓰는 import 제거
// import { getL2IDFromMac } from "../utils/utils";
import { checkDuplication } from "../utils/utils";

export default function RegisterDevice({ setActivePage }) {
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ 제출 시 정규화: 공백 제거(+ 필요하면 대문자 통일)
    const serialNorm = serial.trim(); // .toUpperCase() 필요하면 추가
    const modelNorm = model.trim();

    if (!serialNorm) {
      alert("serial 번호를 입력해주세요.");
      return;
    }

    // ✅ 중복 체크 (수정 모드가 아니므로 id는 전달하지 않음)
    const { allow } = await checkDuplication({ serial: serialNorm });
    if (!allow) return;

    const registeredAt = new Date().toISOString();

    try {
      await deviceDb.devices.add({
        serial: serialNorm,
        model: modelNorm || null,
        registeredAt,
      });

      alert("디바이스 등록 완료");
      setActivePage("DeviceList");
    } catch (err) {
      // ✅ 유니크 인덱스(&serial) 충돌 대응
      if (err?.name === "ConstraintError") {
        alert("❌ 이미 등록된 장비입니다. 동일한 Serial 이 존재합니다.");
        return;
      }
      console.error("등록 실패:", err);
      alert("디바이스 등록 실패");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-700 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        모니터링 관리 대상 장치 등록
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Serial Number</label>
          <input
            type="text"
            value={serial}
            // ✅ 입력 중엔 trim 하지 마세요(사용자 입력 경험 저하 방지)
            onChange={(e) => setSerial(e.target.value)}
            placeholder="예: K8QR2A2V10001"
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">모델</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="예: Smart-RSU"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            className="px-4 py-2 bg-gray-400 text-white rounded"
            onClick={() => setActivePage("DeviceList")}
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            등록
          </button>
        </div>
      </form>
    </div>
  );
}
