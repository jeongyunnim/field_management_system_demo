// stores/RseStore.jsx
import { create } from "zustand";
import { parseRsePacket } from "../utils/parseRse";

const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);
const hasFix = (gnss) => isFiniteNum(gnss?.lat) && isFiniteNum(gnss?.lon);

// 스토어는 모듈 스코프에서 1회 생성
export const useRseStore = create((set, get) => ({
  byId: {}, // { [id]: { id, serial, rseStatus, gnss, msgPerSec, _ts } }
  warningById: {},
  // ----- 지도용 셀렉터들 -----
  // 모든 RSE 목록
  selectAll: () => Object.values(get().byId),
  // 유효 좌표가 있는 RSE만 (마커 렌더용)
  selectAllWithFix: () =>
    Object.values(get().byId).filter((v) => hasFix(v?.gnss)),
  // Leaflet fitBounds 등에 쓰는 바운즈 ([ [south, west], [north, east] ])
  selectBounds: () => {
    const pts = Object.values(get().byId)
    .map((v) => v?.gnss)
    .filter((g) => hasFix(g))
    .map((g) => [g.lat, g.lon]);
    if (pts.length === 0) return null;
    let south = pts[0][0], north = pts[0][0], west = pts[0][1], east = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [lat, lon] = pts[i];
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
    }
    return [[south, west], [north, east]];
  },
  removeById: (id) => set((s) => {
    const nextById = { ...s.byId };
    const nextWarn = { ...s.warningById };
    delete nextById[id];
    delete nextWarn[id];
    return { byId: nextById, warningById: nextWarn };
  }),
  clear: () => set({ byId: {}, warningById: {} }),
  setWarning: (id, isWarn) =>
    set((s) => {
      const current = !!s.warningById[id];
      const nextVal = !!isWarn;
      if (current === nextVal) return {}; // 변경 없음 → set 생략(리렌더 최소화)
      return { warningById: { ...s.warningById, [id]: nextVal } };
    }),
  upsertRseStatus: (id, serial, raw) => {
    const norm = parseRsePacket(raw);
    if (!norm) return;

    const prev = get().byId[id];
    const now = Date.now();

    const rxTotalNow = Number(norm?.rseStatus?.rxTotal ?? 0);
    const rxTotalPrev = Number(prev?.rseStatus?.rxTotal ?? 0);
    const dt = prev ? Math.max(1, (now - prev._ts) / 1000) : 1;
    const drx = rxTotalNow - rxTotalPrev;
    const msgPerSec = drx >= 0 ? drx / dt : 0;

  const next = {
    id,
    serial,
    ...norm,
    msgPerSec: Number(msgPerSec.toFixed(1)),
    _ts: now,
  };

    const same =
      !!prev &&
      prev.rseStatus?.rxTotal === next.rseStatus?.rxTotal &&
      prev.rseStatus?.txTotal === next.rseStatus?.txTotal &&
      prev.rseStatus?.txReady === next.rseStatus?.txReady &&
      prev.gnss?.lat === next.gnss?.lat &&
      prev.gnss?.lon === next.gnss?.lon &&
      prev.gnss?.headingDeg === next.gnss?.headingDeg;

    if (!same) set((s) => ({ byId: { ...s.byId, [id]: next } }));
  },
}));
