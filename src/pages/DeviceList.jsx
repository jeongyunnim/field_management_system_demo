import { useEffect, useState } from "react";
import { deviceDb } from "../dbms/device_db";
import { Card } from "../components/Card";
import StationMap from "../components/StationMap";

export default function DeviceList({ setActivePage }) {
  const [loading, setLoading] = useState(false);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [stationStatusMap, setStationStatusMap] = useState({});
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
    <div className="grid grid-cols-[2fr_1fr] w-full h-full gap-3">
      <Card className="h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Registered Devices</h2>
          <div className="space-x-2">
            <button
              className="btn-sm btn-text-sm"
              onClick={() => setActivePage("RegisterDevice")}
            >
              + 신규 장치 등록
            </button>
            <button
              className="btn-sm btn-text-sm"
              onClick={() => alert("엑셀 등록 기능은 아직 구현되지 않았습니다.")}
            >
              📥 엑셀 등록
            </button>
          </div>
        </div>
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left bg-gray-900">
              <th className="p-2">□ 선택</th>
              <th className="p-2">Serial</th>
              <th className="p-2">모델명</th>
              <th className="p-2">위도</th>
              <th className="p-2">경도</th>
              <th className="p-2">등록일시</th>
              <th className="p-2">동기화</th>
              <th className="p-2">수정</th>
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
      </Card>
      <Card className="border-l border-gray-300 h-full">
        {
          <StationMap
            latitude={vehiclePosition?.latitude}
            longitude={vehiclePosition?.longitude}
            heading={vehiclePosition?.heading}
            stations={Object.entries(stationStatusMap)
              .filter(
                ([_, s]) => s.gnss_data?.latitude && s.gnss_data?.longitude
              )
              .map(([l2id, status]) => {
                const lat = status.gnss_data.latitude / 1e7;
                const lon = status.gnss_data.longitude / 1e7;

                // 거리 계산
                let distanceKm = null;
                if (vehiclePosition?.latitude && vehiclePosition?.longitude) {
                  const vehLat = vehiclePosition.latitude / 1e7;
                  const vehLon = vehiclePosition.longitude / 1e7;
                  distanceKm = calculateDistanceKm(vehLat, vehLon, lat, lon);
                }

                return {
                  lat,
                  lon,
                  name: `Station ${l2id}`,
                  l2id,
                  distanceKm
                };
              })}
          />
        }
      </Card>
    </div>
  );
}
