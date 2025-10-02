// src/dbms/gnss_db.js
import Dexie from "dexie";

export const gnssDb = new Dexie("GNSSDatabase");

gnssDb.version(1).stores({
  gnssData: "++id,timestamp,latitude,longitude"
});

export const saveGnssData = async (data) => {
  try {
    await gnssDb.gnssData.add({
      ...data,
      timestamp: Date.now() // 저장 시점 기록
    });
    // console.log("✅ GNSS 데이터 저장됨:", data);
  } catch (e) {
    console.error("❌ GNSS 데이터 저장 실패:", e);
  }
};
