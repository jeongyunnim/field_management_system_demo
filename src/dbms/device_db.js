// dbms/device_db.js
import Dexie from "dexie";

export const deviceDb = new Dexie("DeviceDB");

deviceDb.version(1).stores({
  devices: "++id, &serial, model, latitude, longitude, registeredAt",
});
