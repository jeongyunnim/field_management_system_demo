// pages/RegisterDevice.jsx
import { useState } from "react";
import { deviceDb } from "../dbms/device_db";
import { getL2IDFromMac, checkDuplication } from "../utils/utils";

export default function RegisterDevice({ setActivePage }) {
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [mac, setMac] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!ipv4 && !ipv6) {
      alert("IPv4 또는 IPv6 중 하나는 반드시 입력되어야 합니다.");
      return;
    }

    const l2id = getL2IDFromMac(mac);
    if (l2id === null) {
      alert("유효한 MAC 주소 형식이 아닙니다. (예: 00:11:22:33:44:55)");
      return;
    }

    const { allow } = await checkDuplication({ mac, l2id });
    if (!allow) return;

    const registeredAt = new Date().toISOString();

    try {
      await deviceDb.devices.add({
        ipv4: ipv4 || null,
        ipv6: ipv6 || null,
        mac,
        l2id,
        registeredAt
      });

      alert("디바이스 등록 완료");
      setActivePage("DeviceList");
    } catch (err) {
      console.error("등록 실패:", err);
      alert("디바이스 등록 중 오류 발생");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-700 p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        디바이스 등록
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">MAC 주소</label>
          <input
            type="text"
            value={mac}
            onChange={(e) => setMac(e.target.value.trim())}
            placeholder="예: 00:11:22:33:44:55"
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">IPv4 주소</label>
          <input
            type="text"
            value={ipv4}
            onChange={(e) => setIpv4(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
            placeholder="예: 192.168.0.1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">IPv6 주소</label>
          <input
            type="text"
            value={ipv6}
            onChange={(e) => setIpv6(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-800"
            placeholder="예: fe80::1"
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
