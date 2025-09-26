// src/components/StationMap.jsx
import { useMapEvents, MapContainer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-rotatedmarker";
import * as protomapsL from "protomaps-leaflet";

// 기본 아이콘 경로 재지정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// 차량 아이콘
const carIcon = new L.Icon({
  iconUrl: "/icons/car-icon.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// 스테이션 아이콘
const stationIcon = new L.Icon({
  iconUrl: "/icons/station-icon.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// ✅ 기본 중심(값 없을 때)
const DEFAULT_CENTER = { lat: 37.5665, lon: 126.9780 }; // 서울시청
// ✅ 샘플 스테이션(없으면 임시로 뿌림)
const makeSampleStations = (c = DEFAULT_CENTER) => ([
  { name: "Sample A", l2id: "A001", lat: c.lat + 0.003, lon: c.lon + 0.003, distanceKm: 0.5 },
  { name: "Sample B", l2id: "B002", lat: c.lat - 0.002, lon: c.lon + 0.004, distanceKm: 1.2 },
  { name: "Sample C", l2id: "C003", lat: c.lat + 0.004, lon: c.lon - 0.002, distanceKm: 2.8 },
]);

// 1e7 스케일/소수 둘 다 지원 + 유효성 체크
function normalizeLatLon(rawLat, rawLon) {
  const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);
  let lat = isFiniteNum(rawLat) ? rawLat : null;
  let lon = isFiniteNum(rawLon) ? rawLon : null;

  // 정규화(스케일링)
  if (lat != null && Math.abs(lat) > 90) lat = lat / 1e7;
  if (lon != null && Math.abs(lon) > 180) lon = lon / 1e7;

  // 범위검사 실패 시 무효 처리
  if (!(typeof lat === "number" && Math.abs(lat) <= 90)) lat = null;
  if (!(typeof lon === "number" && Math.abs(lon) <= 180)) lon = null;

  // 둘 중 하나라도 없다면 기본값
  if (lat == null || lon == null) return { ...DEFAULT_CENTER, isFallback: true };
  return { lat, lon, isFallback: false };
}

// PMTiles(벡터) 레이어
function PMTilesVectorLayer({ pmtilesPath = "/maps/seoulToGunsan.pmtiles" }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // SSR 안전
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absUrl = `${origin}${pmtilesPath}`;
    const layer = protomapsL.leafletLayer({ url: absUrl, flavor: "light", lang: "ko" });
    layer.addTo(map);
    return () => {
      try { map.removeLayer(layer); } catch {}
    };
  }, [map, pmtilesPath]);
  return null;
}

// 지도 따라가기
function RecenterMap({ lat, lon, autoFollow }) {
  const map = useMap();
  const prevRef = useRef({ lat: null, lon: null });

  useEffect(() => {
    if (lat == null || lon == null) return;
    if (!autoFollow) return;
    if (prevRef.current.lat === lat && prevRef.current.lon === lon) return;
    prevRef.current = { lat, lon };
    try {
      map.easeTo({ center: [lat, lon], duration: 350 });
    } catch {
      map.setView([lat, lon]);
    }
  }, [lat, lon, autoFollow, map]);

  return null;
}

function MapInteractions({ onUserInteract }) {
  useMapEvents({
    dragstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
    zoomstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
    touchstart: (e) => { if (e?.originalEvent) onUserInteract?.(); },
  });
  return null;
}

function MapControl({ autoFollow, setAutoFollow }) {
  const map = useMap();
  const btnRef = useRef(null);
  const controlRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const makeButton = (onClick, initial = false) => {
      const container = L.DomUtil.create("div", "");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "지도를 드래그/확대하면 자동으로 꺼집니다";
      btn.setAttribute("aria-pressed", String(!!initial));
      btn.setAttribute("tabindex", "0");
      btn.innerText = initial ? "추적: 켜짐" : "추적: 꺼짐";
      btn.className = "px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors";
      btn.className += initial ? " bg-indigo-600 text-white" : " bg-gray-600 text-white";
      btn.style.minWidth = "96px";
      btn.style.height = "40px";
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.cursor = "pointer";
      btn.style.userSelect = "none";
      btn.style.border = "0";

      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      });
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.disableScrollPropagation(btn);
      container.appendChild(btn);
      L.DomEvent.on(btn, "click", onClick);
      return { container, btn };
    };

    const onClick = (e) => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      setAutoFollow((v) => !v);
    };

    try {
      const { btn } = makeButton(onClick, autoFollow);
      const control = L.control({ position: "topright" });
      control.onAdd = () => {
        const wrapper = L.DomUtil.create("div", "leaflet-bar");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "center";
        wrapper.style.padding = "2px";
        wrapper.style.margin = "4px";
        wrapper.appendChild(btn);
        L.DomEvent.disableClickPropagation(wrapper);
        return wrapper;
      };
      control.addTo(map);
      controlRef.current = control;
      btnRef.current = btn;
    } catch (err) {
      console.warn("MapControl: leaflet control add failed:", err);
    }

    return () => {
      try { controlRef.current?.remove?.(); } catch {}
      if (btnRef.current) {
        try { L.DomEvent.off(btnRef.current, "click"); } catch {}
        btnRef.current = null;
      }
      controlRef.current = null;
    };
  }, [map]); // mount once

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    btn.innerText = autoFollow ? "추적: 켜짐" : "추적: 꺼짐";
    btn.style.background = autoFollow ? "#2563eb" : "#6b7280";
  }, [autoFollow]);

  return null;
}

export default function StationMap({
  latitude,
  longitude,
  heading = 0,
  stations = [],
  useFallbackWhenEmpty = true, // ★ 값 없을 때 임의 값 쓸지 여부
}) {
  // 항상 맵은 렌더 → 좌표가 없으면 기본 좌표 사용
  const norm = normalizeLatLon(latitude, longitude);
  const center = { lat: norm.lat, lon: norm.lon };
  const isFallback = norm.isFallback;

  // 스테이션 데이터 없으면 샘플 생성
  const stationsToShow = (stations && stations.length > 0)
    ? stations
    : (useFallbackWhenEmpty ? makeSampleStations(center) : []);

  const [autoFollow, setAutoFollow] = useState(true);

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={15}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
    >
      <PMTilesVectorLayer pmtilesPath="/maps/seoulToGunsan.pmtiles" />

      {/* 차량 마커: 값이 없어도 기본 좌표에 임시로 표시 */}
      <Marker
        position={[center.lat, center.lon]}
        icon={carIcon}
        rotationAngle={Number.isFinite(heading) ? heading : 0}
        rotationOrigin="center"
      >
        <Popup>
          차량 위치<br />
          {center.lat.toFixed(6)}, {center.lon.toFixed(6)}
          {isFallback && (
            <>
              <br /><em>(임시 위치 — 입력 좌표 없음)</em>
            </>
          )}
        </Popup>
      </Marker>

      {/* 스테이션 마커 */}
      {stationsToShow.map((station, idx) => (
        <Marker key={idx} position={[station.lat, station.lon]} icon={stationIcon}>
          <Popup>
            <strong>{station.name ?? `Station #${idx + 1}`}</strong><br />
            {station.l2id && <>L2ID: {station.l2id}<br /></>}
            {Number.isFinite(station.distanceKm) && (
              <>
                거리: {Number(station.distanceKm) < 1
                  ? `${(Number(station.distanceKm) * 1000).toFixed(1)} m`
                  : `${Number(station.distanceKm).toFixed(1)} km`}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      <RecenterMap lat={center.lat} lon={center.lon} autoFollow={autoFollow} />
      <MapInteractions onUserInteract={() => setAutoFollow(false)} />
      <MapControl autoFollow={autoFollow} setAutoFollow={setAutoFollow} />
    </MapContainer>
  );
}
