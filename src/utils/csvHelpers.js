// src/utils/csvHelpers.js
export const toIso = (ms) => {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tz) % 60).padStart(2, "0");
  return d.toISOString().replace("Z", `${sign}${hh}:${mm}`);
};

// helper: epoch seconds automatic 판단(1970 vs 2004)
export const epochSecToDateAuto = (sec) => {
  const n = Number(sec);
  if (!Number.isFinite(n)) return NaN;
  const base2004 = Date.UTC(2004, 0, 1);
  const d1970 = n * 1000;
  const d2004 = base2004 + n * 1000;
  return Math.abs(d2004 - Date.now()) <= Math.abs(d1970 - Date.now()) ? d2004 : d1970;
};

// from gnss UTC parts -> ms
export const fromUtcPartsMs = ({ y, m, d, hh, mm, ss }) =>
  Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);

// is value effectively a "bad" number
const isNonFiniteLike = (v) => {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v);
  if (typeof v === "string") return /^\s*(nan|-?nan|none|null|n\/a)\s*$/i.test(v);
  return false;
};

// N: number-safe formatter -> returns "" for bad values, otherwise string or fixed
export const N = (v, digits = null) => {
  if (isNonFiniteLike(v)) return "";
  const f = Number(v);
  if (!Number.isFinite(f)) return "";
  return digits == null ? String(f) : f.toFixed(digits);
};

// B: boolean formatter -> "1" / "0" / ""
export const B = (v) => (v === true ? "1" : v === false ? "0" : "");

// CSV escaping & building
export const csvEscape = (s) => {
  const str = String(s ?? "");
  if (str === "") return "";
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const buildCsv = (rows, header) => {
  const head = header.map(csvEscape).join(",");
  const body = rows.map(r => header.map(k => csvEscape(r[k])).join(",")).join("\r\n");
  return head + "\r\n" + body + "\r\n";
};
