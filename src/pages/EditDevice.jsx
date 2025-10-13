// pages/EditDevice.jsx
import { useEffect, useState } from "react";
import { deviceDb } from "../dbms/deviceDb";
import { checkDuplication } from "../utils/utils";

export default function EditDevice({ setActivePage }) {
  const [device, setDevice] = useState(null);
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [mac, setMac] = useState("");

  const id = parseInt(sessionStorage.getItem("editDeviceId"), 10);

  useEffect(() => {
    const fetch = async () => {
      const found = await deviceDb.devices.get(id);
      if (!found) {
        alert("디바이스를 찾을 수 없습니다.");
        setActivePage("DeviceList");
        return;
      }

      setDevice(found);
      setIpv4(found.ipv4 || "");
      setIpv6(found.ipv6 || "");
      setMac(found.mac || "");
    };

    fetch();
  }, [id, setActivePage]);

  const handleSave = async () => {
    if (!ipv4 && !ipv6) {
      alert("IPv4 또는 IPv6는 최소 하나는 입력해야 합니다.");
      return;
    }

    const { allow } = await checkDuplication({ id, mac });
    if (!allow) return;

    await deviceDb.devices.update(id, {
      ipv4,
      ipv6,
      mac,
    });

    alert("디바이스 정보가 수정되었습니다.");
    setActivePage("DeviceList");
  };

  if (!device)
    return <div className="p-4">⏳ 디바이스 정보를 불러오는 중...</div>;

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-700 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        디바이스 수정
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium">MAC 주소</label>
          <input
            type="text"
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">IPv4</label>
          <input
            type="text"
            value={ipv4}
            onChange={(e) => setIpv4(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">IPv6</label>
          <input
            type="text"
            value={ipv6}
            onChange={(e) => setIpv6(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
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
