// src/components/PMTilesLayer.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as pmtiles from "pmtiles";

/**
 * props:
 *  - url: string (예: "/tiles/my-area.pmtiles")
 *  - options: 객체 (leafletRasterLayer 옵션)
 */
export default function PMTilesLayer({ url, options = {} }) {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    let cancelled = false;

    (async () => {
      try {
        // PMTiles 인스턴스 생성 (문법 중요)
        const source = new pmtiles.PMTiles(url);

        // 라스터 PMTiles를 Leaflet 레이어로 래핑
        layer = pmtiles.leafletRasterLayer(source, options);

        if (cancelled) return;
        layer.addTo(map);
      } catch (err) {
        console.error("Failed to load PMTiles:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (layer) {
        try { map.removeLayer(layer); } catch (e) {}
      }
    };
  }, [url, map, JSON.stringify(options)]);

  return null;
}
