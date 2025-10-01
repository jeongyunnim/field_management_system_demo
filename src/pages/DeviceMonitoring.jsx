// src/pages/DeviceMonitoring.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useMqttStore } from "../stores/MqttStore";
import { saveV2XMessage, msgDb } from "../dbms/v2x_msg_db";
import { updateMessageCount, countDb } from "../dbms/v2x_count_db";
import { saveGnssData, gnssDb } from "../dbms/gnss_db";
import { Card } from "../components/common/Card";
import MonitoringDeviceList from "../components/MonitoringDeviceList";
import StationMapPanel from "../components/StationMapPanel";
import { BookDashed, BookCheck, ShieldOff, ShieldCheck, RefreshCcw, Layers as DummyIcon } from "lucide-react";
import SystemResourcePanel from "../depretecated/SystemResourcePanel";
import Led from "../components/common/Led";
import SignalBars from "../components/common/SignalBars";
import { rssiToBars } from "../utils/signal";

// const snrBars = rssiToBars(selected?.rssi);

export default function DeviceMonitoring({ embed = false, onVehiclePosition, onStatusUpdate }) {
  const intervalRef = useRef(null);
  const addMessageHandler = useMqttStore((s) => s.addMessageHandler);
  const subscribeTopics  = useMqttStore((s) => s.subscribeTopics);
  const unsubscribeTopics= useMqttStore((s) => s.unsubscribeTopics);
  const publish          = useMqttStore((s) => s.publish);
  const connected        = useMqttStore((s) => s.connected);

  const [loading, setLoading] = useState(false);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [stationStatusMap, setStationStatusMap] = useState({});
  const [selected, setSelected] = useState(null); // <- 클릭된 항목

  const handleStatusUpdate = (l2id, status) => {
    setStationStatusMap((prev) => ({ ...prev, [l2id]: status }));
    onStatusUpdate?.(l2id, status);
  };

  const REQ_TOPIC   = "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/V2X_MAINTENANCE_HUB_PA/cv2xPktMsg/req";
  const RESP_SUFFIX = "/cv2xPktMsg/resp";
  const REQUEST_ID  = "abc12345";
  const hsRef = useRef({ inFlight:false, ack:false, timer:null, attempt:0 });

  useEffect(() => {
    const topics = [
      "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/cv2xPktMsg/resp",
      "fac/V2X_MAINTENANCE_HUB_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/cv2xPktMsg/jsonMsg",
      "fac/GNSS_PA/ALL/gpsData/jsonMsg",
    ];
    subscribeTopics(topics, { qos: 0 });

    const off = addMessageHandler(async (topic, message) => {
      if (topic.endsWith("/cv2xPktMsg/jsonMsg")) {
        try {
          const payload = JSON.parse(message.toString());
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

      if (topic === "fac/GNSS_PA/ALL/gpsData/jsonMsg") {
        try {
          const payload = JSON.parse(message.toString());
          if (payload?.data) {
            await saveGnssData(payload.data);
            const { latitude, longitude } = payload.data;
            if (latitude && longitude) {
              const headingDeg = (payload.data.heading ?? 0) / 100;
              const vp = { latitude, longitude, heading: headingDeg };
              setVehiclePosition(vp);
              onVehiclePosition?.(vp);
            }
          }
        } catch (e) {
          console.warn("GNSS JSON parse failed:", e);
        }
        return;
      }

      if (topic.endsWith(RESP_SUFFIX)) {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.status === "ok" && (!payload.requestId || payload.requestId === REQUEST_ID)) {
            hsRef.current.ack = true;
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

  const sendSubscribeOnce = () => {
    return publish(
      REQ_TOPIC,
      { action: "subscribe", options: { requestId: REQUEST_ID, filter: { l2id: "0", packetType: "ALL" } } },
      { qos: 0 }
    );
  };

  const startSubscribeHandshake = (maxRetries = 1, timeoutMs = 3000) => {
    if (!connected) return;
    const s = hsRef.current;
    if (s.inFlight) return;
    s.inFlight = true; s.ack = false; s.attempt = 0;
    const finish = () => { if (s.timer) clearTimeout(s.timer); s.timer = null; s.inFlight = false; };
    const attempt = () => {
      if (s.ack) return finish();
      if (s.attempt > maxRetries) return finish();
      s.attempt += 1;
      const ok = sendSubscribeOnce();
      if (!ok) return finish();
      s.timer = setTimeout(attempt, timeoutMs);
    };
    attempt();
  };
  const cancelSubscribeHandshake = () => { const s = hsRef.current; s.ack = false; s.inFlight = false; if (s.timer) { clearTimeout(s.timer); s.timer = null; } };

  // ---- DEMO: 더미 데이터 ----
  async function seedDemoData({ stations = 8 } = {}) {
    setLoading(true);
    try {
      const center = { lat: 37.5665, lon: 126.9780 };
      const veh = jitter(center, 0.02);
      setVehiclePosition({ latitude: Math.round(veh.lat * 1e7), longitude: Math.round(veh.lon * 1e7), heading: Math.floor(Math.random() * 360) });

      let first = null;
      for (let i = 0; i < stations; i++) {
        const serial = "K8QR2A2V10001";
        const l2id = String(1000 + i);
        const p = jitter(center, 0.08);
        const ts = Date.now() - Math.floor(Math.random() * 30_000);
        await saveGnssData({ serial, l2id, ts, latitude: Math.round(p.lat * 1e7), longitude: Math.round(p.lon * 1e7), speedKmh: Math.floor(Math.random() * 80), headingDeg: Math.floor(Math.random() * 360), fix: "3D-FIX" });
        const psid = ["0x8002", "0x8003", "0x8004"][Math.floor(Math.random() * 3)];
        const rssi = -50 - Math.floor(Math.random() * 30);
        await updateMessageCount({ psid, l2idSrc: l2id, rssi });
        await saveV2XMessage({ l2id, msgType: ["BSM","RSI","RSM"][Math.floor(Math.random()*3)], ts, payload: { id: `demo-${l2id}-${ts}` } });
        const active = Math.random() > 0.1;
        const hwHealth = 60 + Math.floor(Math.random() * 40); // 60~100
        handleStatusUpdate(l2id, { gnss_data: { latitude: Math.round(p.lat * 1e7), longitude: Math.round(p.lon * 1e7) }, lastMsgTs: ts });
        if (!first) first = { l2id, serial: `K8QR2A2V${String(l2id).padStart(5, "0")}`, rssi, active, hwHealth };
      }
      if (first) setSelected(first); // why: 초기 선택
    } catch (e) {
      console.error(e);
      alert("더미 데이터 생성 실패");
    } finally {
      setLoading(false);
    }
  }
  function jitter({ lat, lon }, radius = 0.05) {
    const dLat = (Math.random() - 0.5) * radius;
    const dLon = (Math.random() - 0.5) * radius;
    return { lat: lat + dLat, lon: lon + dLon };
  }

  return (
    <div className="grid w-full h-full">
      {/* 좌: 요약 + 리스트 */}
      <Card className="p-4 overflow-hidden flex flex-col min-h-0">
        <div className="flex items-start justify-between mb-3">
          <h2 className="main-card-title">장치 모니터링</h2>
          <div className="flex gap-2" >
          <button className="btn-sm btn-text-sm inline-flex items-center gap-1" onClick={() => seedDemoData({ stations: 10 })} disabled={loading} title="더미 데이터 추가">
              <DummyIcon size={16} /> 더미 데이터
            </button>
            <button className="btn-sm btn-text-sm inline-flex items-center gap-1" onClick={async () => {
              const ok = window.confirm("DB 초기화할까요?");
              if (!ok) return;
              setLoading(true);
              try { await msgDb.messages.clear(); await countDb.counts.clear(); await gnssDb.gnssData.clear(); setStationStatusMap({}); setSelected(null); }
              finally { setLoading(false); }
            }} disabled={loading} title="DB 초기화">
              <RefreshCcw size={16} /> 초기화
            </button>
          </div>
        </div>

        {/* 상단 비주얼 요약 */}
        <SummaryPanel selected={selected} />

        {/* 하단 리스트(클릭 → 위 패널 갱신) */}
        <div className="mt-4 min-h-0" style={{ height: "calc(100% - 220px)" }}>
          <MonitoringDeviceList
            className="h-full"
            selectedId={selected?.l2id}
            onSelect={(it) => setSelected(it)}
          />
        </div>
      </Card>
    </div>
  );
}

/* ================== 상단 요약 패널 ================== */
function SummaryPanel({ selected }) {
  if (!selected) {
    return (
      <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/60 p-4">
        <div className="text-slate-400">하단 목록을 클릭하면 상세정보가 표시됩니다.</div>
      </div>
    );
  }
  const okPct = selected.hwHealth ?? 72;
  const badPct = Math.max(0, 100 - okPct);
  const snrBars = rssiToBars(selected.rssi);

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-[#122033]/80 p-4 text-slate-300 text-sm">
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* 좌: 기본 정보 + LED */}
        <div className="flex items-center gap-2 col-span-4 justify-between">
          <div className="flex items-center gap-4">
            <Led on={!!selected.active} />
            <div className="px-2 py-1.5 rounded-lg bg-[#0f172a] ring-1 ring-white/10 text-slate-200 w-40">
              {selected.serial}
            </div>
          </div>
        </div>
        <div className="col-start-6 col-span-5 flex items-end gap-1 mb-2" aria-label="신호 세기">
          <SignalBars bars={snrBars} />
          <span className="ml-2">60 dBm</span>
        </div>
        <div className="col-span-2 device-inspection-icon-btn bg-rose-900/90">
          <span>재부팅</span>
        </div>
        
        <div className="flex justify-between col-span-12 space-x-2">
          {/* 맵 데이터 업데이트 */}
          <div className="w-40 device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>MAP Data 업데이트</span>
          </div>
          {/* 장치 제어 */}
          <div className="w-40 device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>장치제어(SNMP)</span>
          </div>
          {/* sw 업데이트 */}
          <div className="w-40 device-inspection-icon-btn justify-center bg-cyan-900/90">
            <span>S/W 업데이트</span>
          </div>
          {/* 디버그 정보 */}
          <div className="w-40 device-inspection-icon-btn items-center justify-center bg-cyan-900/90">
            <span>디버그 정보 저장</span>
          </div>
        </div>
        
        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>물리 보안</span>
          <ShieldCheck size={50}/>
          <span>적용 중</span>
        </div>
        <div className="h-36 col-span-2 device-inspection-icon-btn bg-emerald-900/90">
          <span>인증서</span>
          <BookCheck size={50}/>
          <span>D-4</span>
        </div>

        {/* 중: H/W 상태 도넛 + 모듈 배지 */}
        <div className="col-span-4 row-span-2 flex items-center justify-center gap-4">
          <div className="relative w-36 h-36">
            <div
              className="absolute inset-0 rounded-full rotate-180"
              style={{ background: `conic-gradient(#28B555 0 ${okPct}%, #FF4D4D 0 ${okPct + badPct}%)` }}
              aria-label="HW health"
              title={`정상 ${okPct}% / 주의 ${badPct}%`}
            />
            <div className="absolute inset-[10px] rounded-full bg-[#0f172a]" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-slate-200 text-2xl font-semibold">{okPct}%</span>
            </div>
          </div>
        </div>
      <SystemResourcePanel />
      </div>
    </div>
  );
}
