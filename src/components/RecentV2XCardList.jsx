import { useEffect, useState } from "react";
import { countDb } from "../dbms/v2x_count_db";
import { deviceDb } from "../dbms/device_db";
import StationCard from "./StationCard";

export default function RecentV2XCardList({ onStatusUpdate }) {
  const [groupedData, setGroupedData] = useState({});
  const [registeredL2IDs, setRegisteredL2IDs] = useState(new Set());
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const counts = await countDb.counts.toArray();
        const deviceList = await deviceDb.devices.toArray();
        const registeredSet = new Set(deviceList.map((d) => String(d.l2id)));
        const now = Date.now();
        const grouped = {};

        setDevices(deviceList);

        setRegisteredL2IDs(registeredSet);

        for (const entry of counts) {
          const { l2idSrc, psid, count, lastUpdated } = entry;

          if (l2idSrc == null) continue;

          const l2idSrcKey = String(l2idSrc);

          if (!grouped[l2idSrcKey]) {
            grouped[l2idSrcKey] = {
              psidCount: {},
              recentCount: 0,
              lastRssi: null
            };
          }

          // 전체 누적 count 표시
          if (psid) {
            grouped[l2idSrcKey].psidCount[psid] =
              (grouped[l2idSrcKey].psidCount[psid] || 0) + count;
          }

          // 최근 1초 이내 메시지 수
          if (now - lastUpdated <= 1000) {
            grouped[l2idSrcKey].recentCount += 1;
          }

          // 마지막 RSSI 기록
          if (entry.lastRssi !== undefined) {
            grouped[l2idSrcKey].lastRssi = entry.lastRssi;
          }
        }

        setGroupedData(grouped);
      } catch (e) {
        console.error("❌ Failed to load count data:", e);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="mt-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        📡 Recent Station Activity
      </h3>
      {Object.keys(groupedData).length === 0 ? (
        <div className="flex justify-center items-center h-32 text-gray-500">
          <svg
            className="animate-spin h-6 w-6 mr-3 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Searching for stations...</span>
        </div>
      ) : (
        Object.entries(groupedData).map(([l2idSrc, data]) => {
          const device = devices.find(
            (d) => String(d.l2id) === String(l2idSrc)
          );
          return (
            <StationCard
              key={l2idSrc}
              l2idSrc={l2idSrc}
              ipv4={device?.ipv4}
              psidCount={data.psidCount}
              msgPerSec={data.recentCount}
              lastRssi={data.lastRssi}
              isRegistered={registeredL2IDs.has(String(l2idSrc))}
              onStatusUpdate={onStatusUpdate}
            />
          );
        })
      )}
    </div>
  );
}
