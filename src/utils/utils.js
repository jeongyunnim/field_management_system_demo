// src/utils/utils.js
import { deviceDb } from "../dbms/device_db";

export function getL2IDFromMac(macAddress) {
  const parts = macAddress.split(":");
  if (parts.length !== 6) return null;

  const macBytes = parts.map((p) => parseInt(p, 16));
  if (macBytes.some((b) => isNaN(b))) return null;

  return (macBytes[3] << 16) | (macBytes[4] << 8) | macBytes[5];
}

export async function checkDuplication({ id = null, mac, l2id }) {
  // MAC 중복 검사 (자기 자신 제외)
  const macDup = await deviceDb.devices
    .where("mac")
    .equals(mac)
    .filter((d) => d.id !== id)
    .first();

  if (macDup) {
    alert(`❌ 이미 등록된 MAC 주소입니다.\n(${macDup.mac})`);
    return { allow: false };
  }

  // L2_ID 중복 검사
  const l2idDup = await deviceDb.devices
    .where("l2id")
    .equals(l2id)
    .filter((d) => d.id !== id)
    .first();

  if (l2idDup) {
    const confirmed = window.confirm(
      `⚠️ 동일한 L2_ID(${l2id})가 이미 존재합니다.\n등록된 MAC: ${l2idDup.mac}\n\n그래도 등록하시겠습니까?`
    );
    return { allow: confirmed };
  }

  return { allow: true };
}

export function utcSecondsSince2004ToDate(seconds) {
  const base = new Date("2004-01-01T00:00:00Z");
  return new Date(base.getTime() + seconds * 1000);
}
