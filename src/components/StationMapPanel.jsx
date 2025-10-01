// src/components/StationMapPanel.jsx
import { memo, useMemo } from "react";
import { Card } from "./common/Card";
import StationMap from "./StationMap";
import { calculateDistanceKm } from "../utils/distance";

function buildStations(stationStatusMap = {}, vehiclePosition) {
  const entries = Object.entries(stationStatusMap);
  if (entries.length === 0) return [];

  let vehicleLat = null;
  let vehicleLon = null;
  if (vehiclePosition?.latitude != null && vehiclePosition?.longitude != null) {
    vehicleLat = vehiclePosition.latitude / 1e7;
    vehicleLon = vehiclePosition.longitude / 1e7;
  }

  return entries
    .filter(([, status]) => status?.gnss_data?.latitude && status?.gnss_data?.longitude)
    .map(([l2id, status]) => {
      const lat = status.gnss_data.latitude / 1e7;
      const lon = status.gnss_data.longitude / 1e7;

      let distanceKm = null;
      if (vehicleLat != null && vehicleLon != null) {
        distanceKm = calculateDistanceKm(vehicleLat, vehicleLon, lat, lon);
      }

      return { lat, lon, name: status?.name ?? ('Station ' + l2id), l2id, distanceKm };
    });
}

const StationMapPanel = function StationMapPanel({
  vehiclePosition,
  stationStatusMap,
  className = "",
  mapProps = {},
}) {
  const stations = useMemo(() => buildStations(stationStatusMap, vehiclePosition), [
    stationStatusMap,
    vehiclePosition?.latitude,
    vehiclePosition?.longitude,
  ]);

  const cardClassName = ["h-full", className].filter(Boolean).join(" ");

  return (
    <Card className={cardClassName}>
      <StationMap
        latitude={vehiclePosition?.latitude}
        longitude={vehiclePosition?.longitude}
        heading={vehiclePosition?.heading}
        stations={stations}
        {...mapProps}
      />
    </Card>
  );
}

export default memo(StationMapPanel, (prev, next) => {
  const prevPos = prev.vehiclePosition ?? {};
  const nextPos = next.vehiclePosition ?? {};
  const vehicleSame =
    prevPos.latitude === nextPos.latitude &&
    prevPos.longitude === nextPos.longitude &&
    prevPos.heading === nextPos.heading;

  return (
    vehicleSame &&
    prev.stationStatusMap === next.stationStatusMap &&
    prev.className === next.className &&
    prev.mapProps === next.mapProps
  );
});

export { buildStations };
