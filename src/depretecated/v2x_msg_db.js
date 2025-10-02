import Dexie from "dexie";

export const msgDb = new Dexie("V2XMessageDB");

msgDb.version(1).stores({
  messages:
    "++id, &transactionId, receiveTime, l2idSrc, l2idDst, psid, generationTime"
});

export async function saveV2XMessage(payload) {
  if (!payload?.rxParams || !payload?.mpdu) return;

  const rx = payload.rxParams;
  const receiveTime = rx.receiveTime; // ✅ UTC 밀리초 기준 값

  // 🔥 오래된 메시지 자동 삭제 (60초 이상 지난 것)
  try {
    const threshold = Date.now() - 60 * 1000;
    await msgDb.messages.where("receiveTime").below(threshold).delete();
  } catch (e) {
    console.warn("⚠️ Failed to delete old messages:", e);
  }

  // ✅ hdr16093 → transport → bcMode → destAddress → extension → content
  let psid = null;
  try {
    psid =
      payload?.hdr16093?.transport?.bcMode?.destAddress?.extension?.content ??
      null;
  } catch (e) {
    console.warn("Failed to extract psid from hdr16093.transport:", e);
  }

  const generationTime =
    payload?.hdr16092?.content?.signedData?.tbsData?.headerInfo
      ?.generationTime ?? null;

  const exists = await msgDb.messages
    .where({
      transactionId: rx.transactionId
    })
    .first();

  if (!exists) {
    try {
      await msgDb.messages.add({
        receiveTime: rx.receiveTime,
        transactionId: rx.transactionId,
        l2idSrc: rx.l2idSrc,
        l2idDst: rx.l2idDst,
        psid: psid,
        generationTime,
        raw: payload
      });
    } catch (e) {
      console.error(
        "❌ Failed to save V2X message: transactionId =",
        rx.transactionId,
        e
      );
    }
  }
}
