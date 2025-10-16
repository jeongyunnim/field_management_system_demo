// src/components/monitor/StationMapPanel.jsx
import { memo, useMemo } from "react";
import StationMap from "./StationMap";
import { useVmStatusStore } from "../../stores/VmStatusStore";

function StationMapPanel({ className = "", mapProps = {} }) {
  const lat = useVmStatusStore(s => s.parsed.gnss?.lat ?? null);
  const lon = useVmStatusStore(s => s.parsed.gnss?.lon ?? null);
  const headingDeg = useVmStatusStore(s => s.parsed.gnss?.headingDeg ?? null);

  // StationMap이 기대하는 1e7 스케일 정수로 변환
  const vehicle = useMemo(() => {
    if (lat == null || lon == null) return null;
    return {
      latitude: Math.round(lat * 1e7),
      longitude: Math.round(lon * 1e7),
      heading: headingDeg ?? undefined,
    };
  }, [lat, lon, headingDeg]);

  return (
    <StationMap
      latitude={vehicle?.latitude}
      longitude={vehicle?.longitude}
      heading={vehicle?.heading}
      {...mapProps}
    />
  );
}

export default memo(
  StationMapPanel,
  (prev, next) => prev.className === next.className && prev.mapProps === next.mapProps
);
