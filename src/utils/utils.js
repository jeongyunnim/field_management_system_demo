// src/utils/utils.js
import { deviceDb } from "../dbms/device_db";

// export function getL2IDFromMac(macAddress) {
//   const parts = macAddress.split(":");
//   if (parts.length !== 6) return null;

//   const macBytes = parts.map((p) => parseInt(p, 16));
//   if (macBytes.some((b) => isNaN(b))) return null;

//   return (macBytes[3] << 16) | (macBytes[4] << 8) | macBytes[5];
// }

export async function checkDuplication({ serial, id = null }) {
  if (!serial) return { allow: true };

  const dup = await deviceDb.devices.get({ serial });

  // 새 등록: dup 있으면 중복
  // 수정: dup가 있고 그 dup의 id가 내 id와 다르면 중복
  if (dup && dup.id !== id) {
    alert(`❌ 이미 등록된 장비입니다.\n(${dup.serial})`);
    return { allow: false };
  }
  return { allow: true };
}
export function utcSecondsSince2004ToDate(seconds) {
  const base = new Date("2004-01-01T00:00:00Z");
  return new Date(base.getTime() + seconds * 1000);
}
