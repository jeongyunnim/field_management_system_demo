export const epochSecToDateAuto = (sec) => {
  const n = Number(sec);
  if (!Number.isFinite(n)) return NaN;
  const base2004 = Date.UTC(2004, 0, 1);
  const d1970 = n * 1000;
  const d2004 = base2004 + n * 1000;
  return Math.abs(d2004 - Date.now()) <= Math.abs(d1970 - Date.now()) ? d2004 : d1970;
};