import { create } from "zustand";

export const useVmStatusStore = create((set, get) => ({
  // 원본을 그대로 보관(검증/디버깅 쉬움)
  raw: null,
  parsed: {
    v2xReady: null,
    freqMHz: undefined,
    bwMHz: undefined,
    txCount: undefined,
    rxCount: undefined,
    gnss: { fix: undefined, lat: undefined, lon: undefined },
  },

  setFromVmStatus(json) {
    const v = normalizeVmStatus(json);
    set({ raw: json, parsed: v });
  },
}));

// ===== 변환 로직 =====
function normalizeVmStatus(msg) {
  if (!msg || typeof msg !== "object") {
    return {
      v2xReady: null,
      freqMHz: undefined,
      bwMHz: undefined,
      txCount: undefined,
      rxCount: undefined,
      gnss: { mode: undefined, lat: undefined, lon: undefined },
    };
  }

  const v2xReady = !!msg.cv2x_tx_ready;
  const freqMHz  = numOrUndef(msg.frequency_mhz);
  const bwMHz    = numOrUndef(msg.channel_bandwidth_mhz);
  const txCount  = numOrUndef(msg.ltev2x_tx_total_count);
  const rxCount  = numOrUndef(msg.ltev2x_rx_total_count);

  const g = msg.gnss_data || {};
  const lat = toFloatLat(g.latitude);
  const lon = toFloatLon(g.longitude);
  const mode = toFixLabel(g.mode, g.status);

  return {
    v2xReady, freqMHz, bwMHz, txCount, rxCount,
    gnss: { mode, lat, lon },
  };
}

// ===== 유틸 ===== TODO: jeseo 유틸 함수로 뺄 수 있으면 빼기
const numOrUndef = (n) => (typeof n === "number" && !Number.isNaN(n) ? n : undefined);

function toFloatLat(n) {
  if (typeof n !== "number") return undefined;
  return Math.abs(n) > 90 ? n / 1e7 : n;
}
function toFloatLon(n) {
  if (typeof n !== "number") return undefined;
  return Math.abs(n) > 180 ? n / 1e7 : n;
}
function toHeadingDeg(n) {
  if (typeof n !== "number") return undefined;
  return n > 360 ? n / 100 : n;
}
function toKmh(speed) {
  if (typeof speed !== "number") return undefined;
  // 속도 단위가 2 → m/s 로 보이면 km/h 환산
  return Math.round((speed * 3.6 + Number.EPSILON) * 10) / 10; // 소수1자리
}
function toFixLabel(mode, status) {
  // 관례: status 2 = fix, mode 3 = 3D
	const modes = ["No Fix", "Fixing", "2D Fix", "3D Fix"];
	return modes[mode];
}
