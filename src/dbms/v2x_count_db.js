import Dexie from "dexie";

export const countDb = new Dexie("V2XCountDB");

// 스키마: 복합 인덱스 포함(권장)
countDb.version(2).stores({
  counts: "++id, [psid+l2idSrc], psid, l2idSrc, count, lastUpdated, lastRssi"
});

// 안전하게 DB 오픈 & 테이블 검사하는 헬퍼
export async function ensureDbReady() {
  try {
    if (!countDb.isOpen()) {
      await countDb.open();
    }
  } catch (e) {
    console.error("Dexie open error:", e);
    throw e;
  }
  // 테이블 존재 확인
  const hasCounts = !!countDb.tables.find(t => t.name === "counts");
  if (!hasCounts) {
    throw new Error("counts table missing in DB schema");
  }
}

// 안전한 조회 함수
export async function getAllCounts() {
  await ensureDbReady();
  // 직접 테이블 객체 사용
  return await countDb.counts.toArray();
}

// 안전한 트랜잭션/업서트 (modify 사용)
export async function updateMessageCount({ psid, l2idSrc, rssi }) {
  await ensureDbReady();
  const key = [psid, l2idSrc];
  const now = Date.now();

  return await countDb.transaction('rw', countDb.counts, async () => {
    const modified = await countDb.counts
      .where('[psid+l2idSrc]')
      .equals(key)
      .modify(rec => {
        rec.count = (rec.count || 0) + 1;
        rec.lastUpdated = now;
        rec.lastRssi = rssi;
      });

    if (modified === 0) {
      await countDb.counts.add({
        psid,
        l2idSrc,
        count: 1,
        lastUpdated: now,
        lastRssi: rssi
      });
    }
  });
}
