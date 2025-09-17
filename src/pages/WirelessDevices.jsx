// src/pages/WirelessDevices.jsx
import { useEffect, useRef, useState } from "react";
import { useMqttStore } from "../stores/MqttStore";
import { saveV2XMessage, msgDb } from "../dbms/v2x_msg_db";
import { updateMessageCount, countDb } from "../dbms/v2x_count_db";
import { saveGnssData, gnssDb } from "../dbms/gnss_db";
import RecentV2XCardList from "../components/RecentV2XCardList";
import StationMap from "../components/StationMap";
import { calculateDistanceKm } from "../utils/distance";

export default function WirelessDevices() {
  const clientRef = useRef(null);
  const intervalRef = useRef(null);
  const addMessageHandler = useMqttStore((s) => s.addMessageHandler);
  const subscribeTopics  = useMqttStore((s) => s.subscribeTopics);
  const unsubscribeTopics= useMqttStore((s) => s.unsubscribeTopics);
  const publish          = useMqttStore((s) => s.publish);
  const connected        = useMqttStore((s) => s.connected);

  const [responses, setResponses] = useState([]);
  const [ackMessage, setAckMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [stationStatusMap, setStationStatusMap] = useState({});
  const handleStatusUpdate = (l2id, status) => {
    setStationStatusMap((prev) => ({ ...prev, [l2id]: status }));
  };

  const REQ_TOPIC   = "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/cv2xPktMsg/req";
  const RESP_SUFFIX = "/cv2xPktMsg/resp";
  const REQUEST_ID  = "abc12345"; // 필요 시 uuid로 대체
  const hsRef = useRef({ inFlight:false, ack:false, timer:null, attempt:0 });

 const startSubscribeHandshake = (maxRetries = 1, timeoutMs = 3000) => {
    if (!connected) return;
    const s = hsRef.current;
    if (s.inFlight) return;

    s.inFlight = true;
    s.ack = false;
    s.attempt = 0;

    const finish = () => {
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      s.inFlight = false;
    };

    const attempt = () => {
      if (s.ack) { finish(); return; }
      if (s.attempt > maxRetries) { finish(); return; }
      s.attempt += 1;

      const ok = sendSubscribeOnce();
      if (!ok) { finish(); return; }

      s.timer = setTimeout(attempt, timeoutMs); // 타임아웃 시 재시도(간단)
    };

    attempt();
  };

  const cancelSubscribeHandshake = () => {
    const s = hsRef.current;
    s.ack = false;
    s.inFlight = false;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
  };

  const handleClearDb = async () => {
    const confirm = window.confirm(
      "정말로 msgDb와 countDb를 초기화하시겠습니까?"
    );
    if (!confirm) return;

    setLoading(true); // 로딩 시작
    try {
      await msgDb.messages.clear();
      console.log("🧹 msgDb cleared");

      await countDb.counts.clear();
      console.log("🧹 countDb cleared");

      await gnssDb.gnssData.clear();
      console.log("🧹 gnssDb cleared");
    } catch (e) {
      console.error("초기화 오류:", e);
      alert("초기화 중 오류 발생");
    } finally {
      setLoading(false); // 로딩 끝
    }
  };

    // 버튼 누를 때: MQTT 토픽 구독 + 앱 프로토콜 구독 요청(publish)
  const handleStart = () => {
    if (!connected) { alert("MQTT가 연결되지 않았습니다."); return; }

    // 1) MQTT 레벨 구독(브로커에 등록)
    subscribeTopics(TOPICS, { qos: 0 });

    // 2) 앱 프로토콜 구독 요청(서버에 “데이터 보내세요” 명령)
    publish(REQ_TOPIC, {
      action: "subscribe",
      options: { requestId: "abc12345", filter: { l2id: "0", packetType: "ALL" } },
    }, { qos: 0 });
  };

  // 버튼에서 중단 누를 때: 필요 시 MQTT 구독 해제 + 앱 프로토콜 unsubscribe
  const handleStop = () => {
    // 1) 앱 프로토콜 구독 해제(서버에 “이제 그만 보내세요”)
    publish(REQ_TOPIC, { action: "unsubscribe", options: { requestId: "abc12345" } }, { qos: 0 });

    // 2) MQTT 레벨 구독 해제(이 컴포넌트 책임 범위)
    unsubscribeTopics(TOPICS);
  };

  // ✅ MQTT 연결 및 polling 자동 시작
  useEffect(() => {
    const topics = [
      "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/cv2xPktMsg/resp",
      "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/cv2xPktMsg/jsonMsg",
      "fac/GNSS_PA/ALL/gpsData/jsonMsg",
      "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/resp",
    ];
    subscribeTopics(topics, { qos: 0 });

    const off = addMessageHandler(async (topic, message /* , packet */) => {
      console.log("got Message: ", topic);
      // 1) cv2x jsonMsg
      if (topic.endsWith("/cv2xPktMsg/jsonMsg")) {
        try {
          const payload = JSON.parse(message.toString());
          console.log("payload: ", payload);
          
          let psid = null;
          try {
            psid = payload?.hdr16093?.transport?.bcMode?.destAddress?.extension?.content ?? null;
          } catch {}
          const l2idSrc = payload?.rxParams?.l2idSrc ?? null;

          let rssi = null;
          try {
            const arr = payload?.rxParams?.rssiDbm8;
            if (Array.isArray(arr) && arr.length > 0) {
              const maxRaw = Math.max(...arr);
              rssi = Math.round((maxRaw / 8) * 10) / 10;
            }
          } catch {}

          if (psid != null && l2idSrc != null) {
            await updateMessageCount({ psid: String(psid), l2idSrc: String(l2idSrc), rssi });
          }
        } catch (e) {
          console.warn("cv2x JSON parse error:", e);
        }
        return;
      }

      // 2) GNSS
      if (topic === "fac/GNSS_PA/ALL/gpsData/jsonMsg") {
        try {
          const payload = JSON.parse(message.toString());
          console.log("payload: ", payload);
          if (payload?.data) {
            await saveGnssData(payload.data);
            const { latitude, longitude } = payload.data;
            if (latitude && longitude) {
              const headingDeg = (payload.data.heading ?? 0) / 100;
              setVehiclePosition({ latitude, longitude, heading: headingDeg });
            }
          }
        } catch (e) {
          console.warn("GNSS JSON parse failed:", e);
        }
        return;
      }

      // 3) startSystemCheck 응답
      if (topic === "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/startSystemCheck/req") {
        console.log("subscribe systemcheck request");
        try {
          const payload = JSON.parse(message.toString());
          console.log("system check resp:", payload?.data?.MSG);
        } catch (e) {
          console.warn("System Check JSON parse failed:", e);
        }
        return;
      }

      // 4) cv2xPktMsg resp (마지막)
      if (topic.endsWith(RESP_SUFFIX)) {
        try {
          const payload = JSON.parse(message.toString());
          setResponses((prev) => [...prev.slice(-49), payload]);

          // ✅ ACK 수신: 동일 requestId면 핸드셰이크 종료 신호
          if (payload.status === "ok" && (!payload.requestId || payload.requestId === REQUEST_ID)) {
            hsRef.current.ack = true;
          }

          if (payload.status === "ok" && payload.meta) {
            setAckMessage({
              action: payload.action || "-",
              requestId: payload.requestId || "-",
              l2id: payload.meta.l2id || "-",
              packetType: payload.meta.packetType || "-",
              timestamp: payload.timestamp || 0,
              message: payload.message || "-",
            });
          }
        } catch (e) {
          console.warn("cv2x resp JSON parse error:", e);
        }
        return;
      }
    });

    if (connected) startSubscribeHandshake(1, 3000);

    return () => {
      off();
      unsubscribeTopics(topics);
      cancelSubscribeHandshake(); 
    };
  }, [addMessageHandler, subscribeTopics, unsubscribeTopics, publish, connected]);

  // ✅ 내부 polling 로직 분리
  const sendSubscribeOnce = () => {
    return publish(
      REQ_TOPIC,
      {
        action: "subscribe",
        options: { requestId: REQUEST_ID, filter: { l2id: "0", packetType: "ALL" } },
      },
      { qos: 0 }
    );
  };

  // const startPolling = () => {
  //   if (!connected) return;
  //   if (intervalRef.current) return;
  //   intervalRef.current = setInterval(() => {
  //     publish(
  //       "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/cv2xPktMsg/req",
  //       {
  //         action: "subscribe",
  //         options: { requestId: "abc12345", filter: { l2id: "0", packetType: "ALL" } },
  //       },
  //       { qos: 0 }
  //     );
  //   }, 1000);
  // };

  // const stopPolling = () => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //     intervalRef.current = null;
  //     console.log("Polling stopped");
  //   }
  // };

  return (
    <div className="flex h-[calc(100vh-4rem)] relative">
      {/* 좌측: 카드 + 버튼 */}
      <div className="w-2/3 p-4 overflow-y-auto">
        {/* 초기화 버튼 */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleClearDb}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
            disabled={loading}
          >
            🧹 데이터 초기화
          </button>
        </div>

        {/* 카드 목록 */}
        <RecentV2XCardList onStatusUpdate={handleStatusUpdate} />
      </div>

      {/* 우측: 지도 */}
      <div className="w-1/3 border-l border-gray-300 h-full">
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
      </div>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 mx-auto mb-4" />
            <div className="text-gray-700 font-semibold">초기화 중...</div>
          </div>
        </div>
      )}
    </div>
  );
}
