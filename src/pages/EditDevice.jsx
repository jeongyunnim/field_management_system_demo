// pages/EditDevice.jsx
import { useEffect, useState, useMemo } from "react";
import Dexie from "dexie";
import { deviceDb, invalidateRegistrationCache } from "../dbms/deviceDb";

export default function EditDevice({ setActivePage }) {
  const id = useMemo(() => {
    const v = Number.parseInt(sessionStorage.getItem("editDeviceId"), 10);
    return Number.isFinite(v) ? v : null;
  }, []);

  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState(null);

  // 폼 로컬 상태 (수정용)
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (!id) {
      alert("잘못된 디바이스 ID 입니다.");
      setActivePage("DeviceList");
      return;
    }

    (async () => {
      try {
        const found = await deviceDb.devices.get(id);
        if (!found) {
          alert("디바이스를 찾을 수 없습니다.");
          setActivePage("DeviceList");
          return;
        }
        setDevice(found);
        setSerial(found.serial ?? "");
        setModel(found.model ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, setActivePage]);

  const handleSave = async () => {
    if (!device) return;

    const nextSerial = (serial ?? "").trim();
    const nextModel = (model ?? "").trim();

    if (!nextSerial) {
      alert("Serial은 비워둘 수 없습니다.");
      return;
    }

    // serial이 변경되었다면 중복 검사
    if (nextSerial !== device.serial) {
      const dup = await deviceDb.devices.where("serial").equals(nextSerial).first();
      if (dup && dup.id !== device.id) {
        alert(`이미 사용 중인 Serial 입니다: ${nextSerial}`);
        return;
      }
    }

    try {
      await deviceDb.transaction("rw", deviceDb.devices, async () => {
        await deviceDb.devices.update(device.id, {
          serial: nextSerial,
          model: nextModel,
        });
      });

      // 등록 캐시 무효화 (serial 바뀐 경우)
      if (nextSerial !== device.serial) {
        invalidateRegistrationCache(device.serial, nextSerial);
      }

      alert("디바이스 정보가 수정되었습니다.");
      setActivePage("DeviceList");
    } catch (e) {
      if (e instanceof Dexie.ConstraintError) {
        // 유니크 인덱스(&serial) 위반 시
        alert("Serial 중복으로 저장할 수 없습니다.");
      } else {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
      }
    }
  };

  if (loading) return <div className="p-4">⏳ 디바이스 정보를 불러오는 중...</div>;
  if (!device) return null;

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">디바이스 수정</h2>

      <div className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium">Serial</label>
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          {serial !== device.serial && (
            <p className="mt-1 text-xs text-gray-500">저장 시 Serial이 변경됩니다.</p>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium">모델</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={() => setActivePage("DeviceList")}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
