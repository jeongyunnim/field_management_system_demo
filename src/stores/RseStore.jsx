// stores/RseStore.jsx
import create from "zustand";
import { parseRsePacket } from "../utils/parseRse";

// 스토어는 모듈 스코프에서 1회 생성
export const useRseStore = create((set, get) => ({
  byId: {}, // { [id]: { id, serial, rseStatus, gnss, msgPerSec, _ts } }

  ingestRsePacket: (id, serial, raw) => {
    const norm = parseRsePacket(raw);
    if (!norm) return;

    const prev = get().byId[id];
    const now = Date.now();

    // 초당 메시지(수신) 계산
    let msgPerSec = 0;
    if (prev && typeof prev.rseStatus?.rxTotal === "number") {
      const dt = Math.max(1, (now - prev._ts) / 1000);
      const drx = norm.rseStatus.rxTotal - prev.rseStatus.rxTotal;
      msgPerSec = drx >= 0 ? drx / dt : 0;
    }

    const next = {
      id,
      serial,
      ...norm,
      msgPerSec: Number(msgPerSec.toFixed(1)),
      _ts: now,
    };

    // 변화 없으면 set 생략 (리렌더 최소화)
    const same =
      prev &&
      prev.rseStatus?.rxTotal === norm.rseStatus.rxTotal &&
      prev.rseStatus?.txTotal === norm.rseStatus.txTotal &&
      prev.rseStatus?.txReady === norm.rseStatus.txReady &&
      prev.gnss?.lat === norm.gnss?.lat &&
      prev.gnss?.lon === norm.gnss?.lon;

    if (!same) set((s) => ({ byId: { ...s.byId, [id]: next } }));
  },
}));
