// utils/tamperUtils.js (간단 유틸 — 컴포넌트 파일에 직접 넣어도 OK)
export function isoWithLocalOffset(date = new Date()) {
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tz) % 60).padStart(2, "0");
  return date.toISOString().replace("Z", `${sign}${hh}:${mm}`);
}

export function makeTransactionId() {
  // 9자리 정수(충분히 랜덤/충돌 적음)
  return Math.floor((Date.now() % 1e9) + Math.floor(Math.random() * 1e6));
}

// RSE 객체에서 ltev2x IP 뽑는 헬퍼 (네가 저장하는 구조에 맞게 조정)
export function getLtev2xIpFromPacket(pkt) {
  // pkt.interface_info?.interface_array 에서 ltev2x0 찾기 우선,
  // 없으면 first non-loopback IPv4 리턴
  try {
    const ifs = pkt?.interface_info?.interface_array;
    if (Array.isArray(ifs)) {
      const ltev = ifs.find(i => i.name === "ltev2x0" && i.ip_addr);
      if (ltev?.ip_addr) return ltev.ip_addr;
      const primary = ifs.find(i => i.ip_addr && i.ip_addr !== "127.0.0.1");
      if (primary) return primary.ip_addr;
    }
  } catch(e) { /* ignore */ }
  return null;
}
