import { useEffect, useState } from "react";
import { deviceDb } from "../dbms/device_db";

export default function DeviceList({ setActivePage }) {
  const [devices, setDevices] = useState([]);

  const loadDevices = async () => {
    const all = await deviceDb.devices.toArray();
    setDevices(all);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleDelete = async (id) => {
    const confirm = window.confirm("정말로 이 디바이스를 삭제하시겠습니까?");
    if (!confirm) return;

    await deviceDb.devices.delete(id);
    await loadDevices(); // 삭제 후 목록 갱신
  };

  const handleEdit = (id) => {
    sessionStorage.setItem("editDeviceId", id);
    setActivePage("EditDevice");
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Registered Devices</h2>
        <div className="space-x-2">
          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={() => setActivePage("RegisterDevice")}
          >
            + 디바이스 등록
          </button>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => alert("엑셀 등록 기능은 아직 구현되지 않았습니다.")}
          >
            📥 엑셀 등록
          </button>
        </div>
      </div>
      <table className="w-full table-auto">
        <thead>
          <tr className="text-left bg-gray-100">
            <th className="p-2">L2_ID</th>
            <th className="p-2">MAC 주소</th>
            <th className="p-2">IPv4</th>
            <th className="p-2">IPv6</th>
            <th className="p-2">등록일시</th>
            <th className="p-2 text-right">작업</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((dev) => (
            <tr key={dev.id} className="border-t">
              <td className="p-2">{dev.l2id}</td>
              <td className="p-2">{dev.mac}</td>
              <td className="p-2">{dev.ipv4}</td>
              <td className="p-2">{dev.ipv6}</td>
              <td className="p-2">
                {new Date(dev.registeredAt).toLocaleString()}
              </td>
              <td className="p-2 text-right space-x-2">
                <button
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                  onClick={() => handleEdit(dev.id)}
                >
                  ✏️ 수정
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => handleDelete(dev.id)}
                >
                  🗑️ 삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
