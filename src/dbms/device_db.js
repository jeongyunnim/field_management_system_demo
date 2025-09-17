// dbms/device_db.js
import Dexie from "dexie";

export const deviceDb = new Dexie("DeviceDB");

deviceDb.version(1).stores({
  devices: "++id, mac, l2id, ipv4, ipv6, registeredAt"
});
