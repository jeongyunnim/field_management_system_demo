// src/components/StationCard.jsx
import { RadioTower, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useEffect, useRef } from "react";
import mqtt from "mqtt";
// import SystemStatusPanel from "./SystemStatusPanel";
import SystemStatusDonut from "./SystemStatusDonut";
import { useState } from "react";
import { gnssDb } from "../dbms/gnss_db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  calculateDistanceKm,
  formatDistance,
  calculateBearing,
  bearingToCompass
} from "../utils/distance";
import { utcSecondsSince2004ToDate } from "../utils/utils";
import CpuMiniChart from "./CpuMiniChart";
import RamMiniChart from "./RamMiniChart";
import EmmcMiniChart from "./EmmcMiniChart";
import { pdf } from "@react-pdf/renderer";
import StationPdfReport from "./StationPdfReport";

export default function StationCard({
  l2idSrc,
  ipv4,
  psidCount = {},
  msgPerSec = 0,
  lastRssi = null,
  isRegistered = false,
  onStatusUpdate = () => {}
}) {
  const clientRef = useRef(null);
  const intervalRef = useRef(null);
  const requestIdRef = useRef(1);

  // 상태에 따른 색상 결정
  const getStatusColor = () => {
    if (msgPerSec === 0) return "text-gray-400"; // 회색
    if (msgPerSec <= 5) return "text-red-500"; // 빨강
    return "text-green-500"; // 초록
  };

  const getSignalLevel = (rssi) => {
    if (rssi === null) return 0;
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    if (rssi >= -90) return 1;
    return 0;
  };

  const [systemStatus, setSystemStatus] = useState(null);

  const getModeLabel = (mode) => {
    switch (mode) {
      case 1:
        return "No Fix"; // MODE_NO_FIX
      case 2:
        return "2D Fix";
      case 3:
        return "3D Fix";
      default:
        return "GPS N/A"; // MODE_NOT_SEEN 또는 기타
    }
  };

  const getTemperatureColor = (celsius) => {
    if (celsius >= 70) return "text-red-600"; // 🔴 고온 경고
    if (celsius >= 50) return "text-orange-500"; // 🟠 따뜻함
    if (celsius >= 30) return "text-yellow-500"; // 🟡 보통
    return "text-blue-500"; // 🔵 시원함
  };

  const latestGnss = useLiveQuery(() =>
    gnssDb.gnssData.orderBy("timestamp").last()
  );

  const [cpuHistory, setCpuHistory] = useState([]);

  const [ramHistory, setRamHistory] = useState([]);

  const [emmcHistory, setEmmcHistory] = useState([]);

  let distanceDisplay = null;
  if (
    latestGnss &&
    systemStatus?.gnss_data?.latitude &&
    systemStatus?.gnss_data?.longitude
  ) {
    const curLat = systemStatus.gnss_data.latitude / 1e7;
    const curLon = systemStatus.gnss_data.longitude / 1e7;
    const refLat = latestGnss.latitude / 1e7;
    const refLon = latestGnss.longitude / 1e7;

    const distKm = calculateDistanceKm(curLat, curLon, refLat, refLon);
    const bearing = calculateBearing(refLat, refLon, curLat, curLon);
    const direction = bearingToCompass(bearing);
    distanceDisplay = `${formatDistance(distKm)} (${direction})`;
  }

  useEffect(() => {
    console.log("📡 rendering StationCard:", {
      l2idSrc,
      ipv4,
      isRegistered
    });

    // 등록된 디바이스만 처리
    if (!isRegistered || !ipv4) return;

    if (clientRef.current?.connected) return; // ✅ 이미 연결돼 있으면 무시

    const client = mqtt.connect(`ws://${ipv4}:9001`); // 포트는 필요에 따라 수정
    clientRef.current = client;

    client.on("connect", () => {
      console.log(`✅ MQTT 연결됨: ${ipv4}`);

      // 구독 추가
      const topic = "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/sysInfoGet/resp";
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error(`❌ Subscribe 실패: ${topic}`, err);
        } else {
          console.log(`📥 Subscribed to ${topic}`);
        }
      });

      startPolling(client);
    });

    client.on("error", (err) => {
      console.error(`❌ MQTT 연결 실패: ${ipv4}`, err);
      client.end();
    });

    client.on("message", (topic, message) => {
      if (topic === "fac/SYS_MON_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/sysInfoGet/resp") {
        try {
          const payload = JSON.parse(message.toString());
          // console.log(`📨 메시지 수신 [${topic}]:`, payload);

          // ✅ requestId만 따로 출력
          if ("requestId" in payload) {
            // console.log(`🆔 수신된 requestId: ${payload.requestId}`);
            // 상태 저장
            setSystemStatus(payload);
          } else {
            console.warn("⚠️ requestId가 응답에 포함되어 있지 않음");
          }
        } catch (err) {
          console.error("❌ JSON 파싱 오류:", err);
        }
      }
    });

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
        clientRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [ipv4, isRegistered]);

  useEffect(() => {
    if (!systemStatus) return;

    const cpuPercent = systemStatus.cpu_usage_status?.cpu_usage_total_percent;
    if (typeof cpuPercent === "number") {
      setCpuHistory((prev) => [...prev.slice(-9), cpuPercent]);
    }

    const ramPercent = systemStatus.memory_usage_status?.memory_usage_percent;
    if (typeof ramPercent === "number") {
      setRamHistory((prev) => [...prev.slice(-9), ramPercent]);
    }

    const emmcPercent =
      systemStatus.storage_usage_status?.storage_usage_percent;
    if (typeof emmcPercent === "number") {
      setEmmcHistory((prev) => [...prev.slice(-9), emmcPercent]);
    }
  }, [systemStatus?.requestId]);

  useEffect(() => {
    if (systemStatus && isRegistered && l2idSrc) {
      onStatusUpdate(l2idSrc, systemStatus); // 부모에게 상태 전달
    }
  }, [systemStatus]);

  const startPolling = (client) => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      const payload = JSON.stringify({
        /* Request Information */
        requestId: requestIdRef.current++,
        /* System Version */
        serial_number: true,
        hardware_version: true,
        os_version: true,
        firmware_version: true,
        build_date: true,
        /* Hardware Status */
        gnss_antenna_status: true,
        ltev2x_antenna1_status: true,
        ltev2x_antenna2_status: true,
        secton_1pps_status: true,
        temperature_status: true,
        v2x_usb_status: true,
        v2x_spi_status: true,
        sram_vbat_status: true,
        /* System Status */
        cpu_usage_status: true,
        memory_usage_status: true,
        storage_usage_status: true,
        network_status: true,
        /* Tamper Secure Status */
        tamper_secure_status: true,
        /* LTEV2X Status */
        ltev2x_tx_ready_status: true,
        /* Statistics */
        ltev2x_stack_rx_stats: true,
        ltev2x_stack_socket_stats: true,
        ltev2x_stack_service_stats: true,
        c2x_stats: true,
        cits_rsu_v2x_stats: true,
        /* Service Status */
        /* Certificate */
        ltev2x_cert_status: true,
        /* GNSS INFO */
        gnss_data: true,
        /* Operation Mode */
        operation_mode_status: true
      });

      client.publish(
        "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SYS_MON_PA/sysInfoGet/req",
        payload,
        { qos: 0 },
        (err) => {
          if (err) console.error("❌ publish error", err);
        }
      );
    }, 1000);
  };

  return (
    <div className="flex border rounded-xl shadow-sm p-4 mb-4 bg-white items-start">
      {/* Left icon */}
      <div className="mr-4 flex-shrink-0 flex items-center text-4xl">
        <RadioTower className={`${getStatusColor()} w-10 h-10`} />
      </div>

      {/* Center info */}
      <div className="flex-1">
        <h4 className="font-bold text-lg text-gray-800 mb-2">
          L2ID: {l2idSrc}
          {isRegistered ? (
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
              등록됨
            </span>
          ) : (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
              미등록
            </span>
          )}
        </h4>
        <ul className="text-sm text-gray-700 space-y-1">
          {Object.entries(psidCount).map(([psid, count]) => (
            <li key={psid}>
              • PSID <span className="font-mono">{psid}</span>: {count}
            </li>
          ))}
        </ul>

        {/* 시스템 판넬 뷰 */}
        {/* {systemStatus && <SystemStatusPanel status={systemStatus} />} */}
        {/* 시스템 상태 도넛 차트 */}
        {systemStatus && <SystemStatusDonut status={systemStatus} />}

        {/* GNSS 모드 및 위성 수 */}
        {systemStatus?.gnss_data && (
          <div className="relative mt-2 inline-block">
            <div className="text-xl font-semibold text-gray-800">
              {getModeLabel(systemStatus.gnss_data.mode)}
            </div>
            <div className="absolute -top-1 -right-3 text-xs text-gray-500">
              {systemStatus.gnss_data.numUsedSatellites}
            </div>
          </div>
        )}

        {systemStatus?.temperature_status?.temperature_celsius !==
          undefined && (
          <div className="mt-2 text-sm text-gray-700">
            {" "}
            <span
              className={`text-base font-semibold ${getTemperatureColor(
                systemStatus.temperature_status.temperature_celsius
              )}`}
            >
              {systemStatus.temperature_status.temperature_celsius.toFixed(1)}°C
            </span>
          </div>
        )}

        {distanceDisplay && (
          <div className="mt-1 text-sm text-gray-700">
            기준 위치와 거리:{" "}
            <span className="font-semibold text-indigo-600">
              {distanceDisplay}
            </span>
          </div>
        )}

        {systemStatus?.certificate &&
          (() => {
            const cert = systemStatus.certificate;
            const now = new Date();
            const end = utcSecondsSince2004ToDate(cert.ltev2x_cert_valid_end);
            const remainingDays = Math.floor(
              (end - now) / (1000 * 60 * 60 * 24)
            );
            const isValid = cert.ltev2x_cert_status_security_enable;
            const isWarning = remainingDays <= 10;
            const isExpired = remainingDays < 0;

            return (
              <div className="mt-2 flex items-center space-x-2 text-sm text-gray-800">
                {/* 아이콘 */}
                <div title={isValid ? "인증서 유효" : "비활성화"}>
                  {isValid ? (
                    isWarning ? (
                      <ShieldAlert className="text-yellow-500 w-5 h-5" />
                    ) : (
                      <ShieldCheck className="text-green-600 w-5 h-5" />
                    )
                  ) : (
                    <ShieldX className="text-red-500 w-5 h-5" />
                  )}
                </div>

                {/* 라벨 */}
                <span className="font-medium">1609.2.1 인증서</span>

                {/* 상태 배지 */}
                {isValid ? (
                  isExpired ? (
                    <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-semibold text-xs line-through">
                      만료됨
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isWarning
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                      title={`유효 종료: ${end.toLocaleString()}`}
                    >
                      D-{remainingDays}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-500 font-semibold">
                    비활성화
                  </span>
                )}
              </div>
            );
          })()}

        {cpuHistory.length > 0 && (
          <div className="mt-2">
            <CpuMiniChart
              usageHistory={cpuHistory}
              currentUsage={cpuHistory[cpuHistory.length - 1]}
            />
          </div>
        )}

        {ramHistory.length > 0 && (
          <div className="mt-2">
            <RamMiniChart
              usageHistory={ramHistory}
              currentUsage={ramHistory[ramHistory.length - 1]}
            />
          </div>
        )}

        {emmcHistory.length > 0 && (
          <div className="mt-2">
            <EmmcMiniChart
              usageHistory={emmcHistory}
              currentUsage={emmcHistory[emmcHistory.length - 1]}
            />
          </div>
        )}
      </div>

      {/* Right stats */}
      <div className="ml-6 text-right">
        <div className="text-sm text-gray-600">Msgs/sec</div>
        <div className="text-2xl font-bold text-green-600">{msgPerSec}</div>

        {/* RSSI 수치 + 막대 가로 배치 */}
        <div className="flex items-end mt-2 space-x-2 justify-end">
          <div className="text-xl font-mono text-blue-600">
            {lastRssi !== null ? lastRssi.toFixed(1) : "N/A"}
          </div>

          <div className="flex items-end space-x-0.5">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`w-1 rounded-sm transition-all duration-300 ${
                  getSignalLevel(lastRssi) >= level
                    ? "bg-green-600"
                    : "bg-gray-300"
                }`}
                style={{ height: `${level * 6}px` }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={async () => {
            const reportData = {
              l2idSrc,
              ipv4,
              psidCount,
              msgPerSec,
              lastRssi,
              isRegistered,
              systemStatus
            };
            const blob = await pdf(
              <StationPdfReport data={reportData} />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `station_${l2idSrc}.pdf`;
            a.click();
          }}
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          📄 리포트 다운로드
        </button>
      </div>
    </div>
  );
}
