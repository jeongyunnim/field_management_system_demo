// src/components/StationMap.jsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-rotatedmarker";

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

// 지도 이동을 위한 내부 컴포넌트
function RecenterMap({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon]);
  }, [lat, lon]);
  return null;
}

export default function StationMap({
  latitude,
  longitude,
  heading,
  stations = [] // ✅ 기본값 설정
}) {
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
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
      <RecenterMap lat={lat} lon={lon} />
    </MapContainer>
  );
}
