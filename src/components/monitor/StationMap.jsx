// src/components/StationMap.jsx
import { MapContainer, Marker, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useState, useRef, useMemo, memo } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-rotatedmarker";
import * as protomapsL from "protomaps-leaflet";
import { useRseStore } from "../../stores/RseStore";
import { useMetricsStore } from "../../stores/MetricsStore";

// ----- Leaflet 기본 아이콘 경로 -----
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// ----- 차량 아이콘 (고정) -----
const carIcon = new L.Icon({ 
  iconUrl: "/assets/Vehicle.png", 
  iconSize: [32, 32], 
  iconAnchor: [16, 32], 
  popupAnchor: [0, -16] 
});

// --- DivIcon 캐시 (warn/selected 조합 4종만) ---
const __rseDivIconCache = new Map(); // key: 'wS'|'wN'|'nS'|'nN'
function makeDivIcon(warn, selected) {
  const key = (warn ? "w" : "n") + (selected ? "S" : "N");
  if (__rseDivIconCache.has(key)) return __rseDivIconCache.get(key);
  const src = warn ? "/assets/RSE_warn.png" : "/assets/RSE.png";
  const icon = new L.DivIcon({
    className: "rse-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: `
      <img class="rse-img ${selected ? "selected" : ""} ${warn ? "warn" : "ok"}"
           src="${src}" alt="RSE" width="32" height="32" />
    `,
  });
  __rseDivIconCache.set(key, icon);
  return icon;
}


// ----- 좌표 정규화 -----
function normalizeLatLon(rawLat, rawLon) {
  const n = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
  let lat = n(rawLat), lon = n(rawLon);
  if (lat != null && Math.abs(lat) > 90) lat /= 1e7;
  if (lon != null && Math.abs(lon) > 180) lon /= 1e7;
  if (!(typeof lat === "number" && Math.abs(lat) <= 90)) lat = null;
  if (!(typeof lon === "number" && Math.abs(lon) <= 180)) lon = null;
  const isFallback = !(lat != null && lon != null);
  if (isFallback) { lat = 37.5665; lon = 126.9780; }
  return { lat, lon, isFallback };
}

// ----- PMTiles 벡터 레이어 -----
function PMTilesVectorLayer({ pmtilesPath = "/maps/seoulToGunsan.pmtiles" }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absUrl = `${origin}${pmtilesPath}`;
    const layer = protomapsL.leafletLayer({ url: absUrl, flavor: "light", lang: "ko" });
    layer.addTo(map);
    return () => { try { map.removeLayer(layer); } catch {} };
  }, [map, pmtilesPath]);
  return null;
}

// ----- 지도 자동 추적 -----
function RecenterMap({ lat, lon, autoFollow }) {
  const map = useMap();
  const prevRef = useRef({ lat: null, lon: null });
  useEffect(() => {
    if (lat == null || lon == null || !autoFollow) return;
    if (prevRef.current.lat === lat && prevRef.current.lon === lon) return;
    prevRef.current = { lat, lon };
    try { map.easeTo({ center: [lat, lon], duration: 350 }); } catch { map.setView([lat, lon]); }
  }, [lat, lon, autoFollow, map]);
  return null;
}

// ----- 사용자 상호작용 시 자동추적 해제 -----
function MapInteractions({ onUserInteract }) {
  useMapEvents({
    dragstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
    zoomstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
    touchstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
  });
  return null;
}

// ----- 간단 추적 토글 컨트롤 -----
function MapControl({ autoFollow, setAutoFollow }) {
  const map = useMap();
  const btnRef = useRef(null);
  const controlRef = useRef(null);
  useEffect(() => {
    if (!map) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "지도를 드래그/확대하면 자동으로 꺼집니다";
    btn.innerText = autoFollow ? "추적: 켜짐" : "추적: 꺼짐";
    btn.className = "leaflet-bar"; // 심플
    btn.style.minWidth = "88px";
    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setAutoFollow((v) => !v); };
    const ctl = L.control({ position: "topright" });
    ctl.onAdd = () => btn;
    ctl.addTo(map);
    btnRef.current = btn;
    controlRef.current = ctl;
    return () => { try { controlRef.current?.remove?.(); } catch {}; btnRef.current = null; controlRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]); // mount once
  useEffect(() => { if (btnRef.current) btnRef.current.innerText = autoFollow ? "추적: 켜짐" : "추적: 꺼짐"; }, [autoFollow]);
  return null;
}

// ----- RSE 마커들 -----
function RseMarkersInline() {
  // 1) 개별 셀렉터로 구독 (객체 생성 금지)
  const byId = useRseStore((s) => s.byId);
  const selectedId = useMetricsStore((s) => s.selectedId);
  const warningById = useMetricsStore((s) => s.warningById);

  // 2) 파생 목록 메모 
  const entries = useMemo(() => {
    const all = Object.values(byId);
    return all.filter((v) => Number.isFinite(v?.gnss?.lat) && Number.isFinite(v?.gnss?.lon));
  }, [byId]);

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((v) => {
        const warn = !!warningById?.[v.id];
        const selected = !!selectedId && v.id === selectedId;
        const icon = makeDivIcon(warn, selected);
        return (
          <Marker key={v.id} position={[v.gnss.lat, v.gnss.lon]} icon={icon} zIndexOffset={selected ? 1000 : 0}>
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.2 }}>
                <div><strong>{v.serial ?? v.id}</strong></div>
                <div>({v.gnss.lat?.toFixed?.(6)}, {v.gnss.lon?.toFixed?.(6)})</div>
                {warn && <div style={{ color: "#dc2626" }}>⚠ Health 비정상</div>}
                {selected && <div style={{ color: "#2563eb" }}>✓ 선택됨</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ----- 메인 컴포넌트 -----
function StationMapImpl({ latitude, longitude, heading = 0 }) {
  const norm = normalizeLatLon(latitude, longitude);
  const center = { lat: norm.lat, lon: norm.lon };
  const isFallback = norm.isFallback;
  const [autoFollow, setAutoFollow] = useState(true);

  return (
    <MapContainer center={[center.lat, center.lon]} zoom={15} scrollWheelZoom style={{ width: "100%", height: "100%", borderRadius: 8 }}>
      <PMTilesVectorLayer pmtilesPath="/maps/seoulToGunsan.pmtiles" />
      <RseMarkersInline />

      {/* 차량 마커 */}
      <Marker position={[center.lat, center.lon]} icon={carIcon} rotationAngle={Number.isFinite(heading) ? heading : 0} rotationOrigin="center">
        <Popup>차량 위치<br />{center.lat.toFixed(6)}, {center.lon.toFixed(6)}</Popup>
      </Marker>

      <RecenterMap lat={center.lat} lon={center.lon} autoFollow={autoFollow && !isFallback} />
      <MapInteractions onUserInteract={() => setAutoFollow(false)} />
      <MapControl autoFollow={autoFollow} setAutoFollow={setAutoFollow} />
    </MapContainer>
  );
}

export default memo(StationMapImpl);
