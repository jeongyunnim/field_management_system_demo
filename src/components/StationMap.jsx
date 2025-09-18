// src/components/StationMap.jsx
import { useMapEvents, MapContainer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-rotatedmarker";

// 🔵 추가: PMTiles + Protomaps(Leaflet) — 벡터 pmtiles 표시용
import * as protomapsL from "protomaps-leaflet";

// 기본 아이콘 경로 재지정
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// 차량 아이콘 설정 (public/icons/car-icon.png 경로 기준)
const carIcon = new L.Icon({
  iconUrl: "/icons/car-icon.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Station 아이콘 설정 (public/icons/station-icon.png 경로 기준)
const stationIcon = new L.Icon({
  iconUrl: "/icons/station-icon.png", // 또는 기본 마커 사용 가능
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// ✅ pmtiles(벡터) 레이어를 Leaflet에 추가하는 내부 컴포넌트
function PMTilesVectorLayer({ pmtilesPath = "/maps/seoulToGunsan.pmtiles" }) {
  const map = useMap();
  useEffect(() => {
    // 절대 URL 권장
    const absUrl = `${window.location.origin}${pmtilesPath}`;

// Protomaps 기본 베이스맵(벡터) — flavor/lang 지정해야 실제로 렌더됩니다.
const layer = protomapsL.leafletLayer({ url: absUrl, flavor: "light", lang: "ko" });
    layer.addTo(map);

    return () => {
      try { map.removeLayer(layer); } catch (e) {}
    };
  }, [map, pmtilesPath]);
  return null;
}

// 지도 이동을 위한 내부 컴포넌트
function RecenterMap({ lat, lon, autoFollow }) {
  const map = useMap();
  const prevRef = useRef({ lat: null, lon: null });

  useEffect(() => {
    // 아무 좌표 없으면 무시
    if (lat == null || lon == null) return;

    // autoFollow 꺼져 있으면 절대 이동하지 않음
    if (!autoFollow) {
      // 단, 한번만: 만약 사용자가 토글을 다시 켰을 때 바로 센터를 차량으로 잡고 싶다면
      // 여기에 map.easeTo 호출을 넣을 수 있음 (현재 의도는 '켜져 있을 때만 따라감')
      return;
    }

    // 같은 좌표로 연속 호출되는 것을 방지(불필요한 easing)
    if (prevRef.current.lat === lat && prevRef.current.lon === lon) return;
    prevRef.current = { lat, lon };

    // 안전하게 부드럽게 이동
    try {
      map.easeTo({ center: [lon, lat], duration: 350 });
      console.log("[RecenterMap] easeTo", lon, lat);
    } catch (e) {
      // fallback
      map.setView([lat, lon]);
      console.log("[RecenterMap] setView fallback", lon, lat, e);
    }
  }, [lat, lon, autoFollow, map]);

  return null;
}


// 사용자가 지도를 직접 조작하면 자동 추적을 끄는 컴포넌트
function MapInteractions({ onUserInteract }) {
  useMapEvents({
    dragstart: (e) => { if (e && e.originalEvent) onUserInteract && onUserInteract(); },
    zoomstart: (e) => { if (e && e.originalEvent) onUserInteract && onUserInteract(); },
    touchstart: (e) => { if (e && e.originalEvent) onUserInteract && onUserInteract(); }
  });
  return null;
}


// --- Replace existing MapControl with this robust version ---
function MapControl({ autoFollow, setAutoFollow }) {
  const map = useMap();
  const btnRef = useRef(null);      // reference to current button element (control or fallback)
  const controlRef = useRef(null);  // reference to leaflet control (if added)

  useEffect(() => {
    if (!map) return;
// ---------- 단순 버전: SVG 제거, 텍스트 버튼 (붙여넣기만) ----------
// MapControl 내부: 기존 makeButton / updateButtonAppearance을 이걸로 대체

const makeButton = (autoFollow) => {
  const container = L.DomUtil.create("div", "");
  // <button> 요소 사용 — 앵커 문제 없음
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = "지도를 드래그/확대하면 자동으로 꺼집니다";
  btn.setAttribute("aria-pressed", String(!!autoFollow));
  btn.setAttribute("tabindex", "0");
  btn.innerText = autoFollow ? "추적: 켜짐" : "추적: 꺼짐";

  // Tailwind 클래스(있으면 적용). 없으면 아래 인라인 스타일이 동작함.
  btn.className = "px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors";
  if (autoFollow) {
    btn.className += " bg-indigo-600 hover:bg-indigo-700 text-white";
  } else {
    btn.className += " bg-gray-600 hover:bg-gray-700 text-white";
  }

  // Inline fallback (안전장치)
  btn.style.minWidth = "96px";
  btn.style.height = "40px";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.cursor = "pointer";
  btn.style.userSelect = "none";
  btn.style.border = "0";
  btn.style.color = btn.style.color || "#fff";
  btn.style.background = btn.style.background || (autoFollow ? "#4f46e5" : "#4b5563");

  // 접근성: 키보드(Enter/Space)
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      btn.click();
    }
  });

  // 맵 드래그 방지
  L.DomEvent.disableClickPropagation(btn);
  L.DomEvent.disableScrollPropagation(btn);

  container.appendChild(btn);
  return { container, btn };
};

    // click handler (stops propagation so map doesn't react)
    const onClick = (e) => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      setAutoFollow(v => !v);
    };

    // 1) Try to add as a proper Leaflet control (preferred)
    try {
      const { container, btn } = makeButton();
      L.DomEvent.on(btn, "click", onClick);

      const control = L.control({ position: "topright" });
      control.onAdd = () => {
        // use leaflet-bar styling container for consistent look
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
      console.warn("MapControl: leaflet control add failed, will try fallback:", err);
    }

    // 2) Fallback: if control wasn't added or got hidden, append a positioned button into map container
    const ensureFallback = () => {
      if (btnRef.current && document.body.contains(btnRef.current)) return; // control exists
      const { container, btn } = makeButton();
      // style wrapper (map container relative positioning assumed)
      const mapContainer = map.getContainer();
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "12px";
      wrapper.style.right = "12px";
      wrapper.style.zIndex = 10000;
      wrapper.style.pointerEvents = "auto";
      wrapper.appendChild(btn);
      // ensure click doesn't propagate to map
      L.DomEvent.on(btn, "click", onClick);
      mapContainer.style.position = mapContainer.style.position || "relative";
      mapContainer.appendChild(wrapper);
      btnRef.current = btn;
      // store wrapper so we can remove on cleanup
      controlRef.current = { _fallbackWrapper: wrapper };
    };

    // try fallback after a short delay in case control was added slightly later
    const t = setTimeout(() => {
      if (!btnRef.current) ensureFallback();
    }, 200);

    // cleanup
    return () => {
      clearTimeout(t);
      // remove leaflet control if present
      try {
        if (controlRef.current && typeof controlRef.current.remove === "function") {
          controlRef.current.remove();
        } else if (controlRef.current && controlRef.current._fallbackWrapper) {
          // remove fallback wrapper
          const w = controlRef.current._fallbackWrapper;
          if (w && w.parentNode) w.parentNode.removeChild(w);
        }
      } catch (e) {}
      // remove any event listeners on button
      if (btnRef.current) {
        try { L.DomEvent.off(btnRef.current, "click"); } catch (e) {}
        btnRef.current = null;
      }
      controlRef.current = null;
    };
  }, [map]); // run once when map available

  // Update button text/color whenever autoFollow changes
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
  heading,
  stations = [] // ✅ 기본값 설정
}) {
  // ▶ 자동 추적 토글 상태
  const [autoFollow, setAutoFollow] = useState(true);

  if (latitude == null || longitude == null) return null;

  const lat = latitude / 1e7;
  const lon = longitude / 1e7;

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={15}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
    >
      {/* 🔁 변경: OSM TileLayer 제거하고, pmtiles 벡터 레이어로 교체 */}
      <PMTilesVectorLayer pmtilesPath="/maps/seoulToGunsan.pmtiles" />

      <Marker
        position={[lat, lon]}
        icon={carIcon}
        rotationAngle={heading} // 각도 설정 (정북 기준 시계방향)
        rotationOrigin="center" // 회전 기준점
      >
        <Popup>
          차량 위치
          <br />
          {lat.toFixed(6)}, {lon.toFixed(6)}
        </Popup>
      </Marker>

      {/* 📡 Station 마커들 추가 */}
      {stations.map((station, idx) => (
        <Marker
          key={idx}
          position={[station.lat, station.lon]}
          icon={stationIcon}
        >
          <Popup>
            <strong>{station.name}</strong>
            <br />
            L2ID: {station.l2id}
            {station.distanceKm != null && !isNaN(station.distanceKm) && (
              <>
                <br />
                거리:{" "}
                {Number(station.distanceKm) < 1
                  ? `${(Number(station.distanceKm) * 1000).toFixed(1)} m`
                  : `${Number(station.distanceKm).toFixed(1)} km`}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      {/* 지도 이동 */}
      <RecenterMap lat={lat} lon={lon} autoFollow={autoFollow} />
      <MapInteractions onUserInteract={() => setAutoFollow(false)} />
      <MapControl autoFollow={autoFollow} setAutoFollow={setAutoFollow} />
    </MapContainer>
  );
}
