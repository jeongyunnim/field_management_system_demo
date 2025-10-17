// dbms/deviceDb.js
import Dexie from "dexie";

export const deviceDb = new Dexie("DeviceDB");

deviceDb.version(1).stores({
  devices: "++id, &serial, model, latitude, longitude, registeredAt",
});

const regCache = new Map(); // serial -> boolean
const TTL_MS = 30_000;
const tsCache = new Map();  // serial -> timestamp

export async function isDeviceRegistered(serial) {
  if (!serial) return false;

  const now = Date.now();
  const ts = tsCache.get(serial);
  if (ts && (now - ts) < TTL_MS && regCache.has(serial)) {
    return regCache.get(serial);
  }

  const found = await deviceDb.devices.where("serial").equals(serial).first();
  const ok = !!found;

  regCache.set(serial, ok);
  tsCache.set(serial, now);
  return ok;
}

// 시리얼 -> DB id 조회(캐시 포함)
const idCache = new Map(); // serial -> { id, ts }
export async function getDeviceIdBySerial(serial) {
  if (!serial) return null;
  const now = Date.now();
  const hit = idCache.get(serial);
  if (hit && (now - hit.ts) < TTL_MS) return hit.id ?? null;

  const row = await deviceDb.devices.where("serial").equals(serial).first();
  const id = row?.id ?? null;
  idCache.set(serial, { id, ts: now });
  return id;
}


export function invalidateRegistrationCache(oldSerial, newSerial) {
  if (oldSerial) {
    regCache.delete(oldSerial);
    tsCache.delete(oldSerial);
  }
  if (newSerial) {
    regCache.delete(newSerial);
    tsCache.delete(newSerial);
  }
}
