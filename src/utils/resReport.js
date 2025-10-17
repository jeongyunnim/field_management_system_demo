/* utils: 안전 접근/포맷 */
const pick = (o, path, def = "-") => {
  try {
    return path.split(".").reduce((a, k) => (a && a[k] != null ? a[k] : undefined), o) ?? def;
  } catch { return def; }
};
const fmtNum = (v, digits = 2, suffix = "") =>
  Number.isFinite(v) ? `${Number(v).toFixed(digits)}${suffix}` : "-";
const fmtInt = (v, suffix = "") => (Number.isFinite(v) ? `${Math.round(v)}${suffix}` : "-");
const fmtPct = (v) => (Number.isFinite(v) ? `${Math.round(v)}%` : "-");
const fmtDateTime = (ms) => {
  if (!Number.isFinite(ms)) return "-";
  const d = new Date(ms);
  // 예: 2025-10-17 14:23:09
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function buildRseReportHTML(latestItems, meta = {}) {
  const startedAt = meta.startedAt ? fmtDateTime(meta.startedAt) : "-";
  const endedAt   = meta.endedAt   ? fmtDateTime(meta.endedAt)   : fmtDateTime(Date.now());

  const rows = (latestItems || []).map((it) => {
    const gnss = it.gnss || {};
    const cell = it.cell || it.modem || {};
    const sys  = it.sys  || it.system || {};

    return {
      id: it.id ?? "-",
      serial: it.serial ?? it.sn ?? "-",
      recvAt: fmtDateTime(it.__receivedAt),
      rawTs:  it.__rawTs ? fmtDateTime(
                typeof it.__rawTs === "number" && it.__rawTs < 3e10
                  ? it.__rawTs * 1000 : it.__rawTs
              ) : "-",
      fw: it.fw?.version ?? it.firmware?.version ?? it.firmware ?? "-",

      lat: fmtNum(gnss.lat, 6),
      lon: fmtNum(gnss.lon, 6),
      alt: fmtNum(gnss.alt, 1, " m"),
      hdop: fmtNum(gnss.hdop, 2),
      speed: fmtNum(gnss.speedKmh ?? gnss.speed_kmh ?? (gnss.speed ? gnss.speed * 3.6 : NaN), 1, " km/h"),
      head: fmtNum(gnss.heading ?? gnss.cog ?? NaN, 0, "°"),

      rssi: fmtInt(cell.rssi, " dBm"),
      rsrp: fmtInt(cell.rsrp, " dBm"),
      rsrq: fmtNum(cell.rsrq, 1, " dB"),
      sinr: fmtNum(cell.sinr, 1, " dB"),
      rat:  cell.rat ?? cell.radio ?? cell.type ?? "-",

      ip:   it.net?.ip ?? it.ip ?? "-",
      rtt:  fmtInt(it.mqtt?.rtt_ms ?? it.net?.mqtt_rtt_ms, " ms"),

      cpuT: fmtNum(sys.cpuTemp ?? sys.cpu_temp, 1, " °C"),
      mem:  fmtPct(sys.memUsedPct ?? sys.mem_pct ?? sys.mem_used_pct),
      disk: fmtPct(sys.diskUsedPct ?? sys.disk_pct ?? sys.disk_used_pct),
      up:   Number.isFinite(sys.uptime_sec) ? `${Math.floor(sys.uptime_sec/3600)}h` : "-",

      pps:  it.tsync?.pps ?? it.pps ?? "-",
      tsync: it.tsync?.status ?? it.timeSync ?? "-",

      cert: pick(it, "security.cert.status", "-"),
      certExp: pick(it, "security.cert.expiresAt", "-"),

      health: fmtPct(it.health?.healthPct ?? it.health?.pct ?? it.health),
      flags: Array.isArray(it.flags) ? it.flags.join(", ") :
             (it.flags || it.warn || it.error || "-"),
    };
  });

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.id}</td><td>${r.serial}</td>
      <td>${r.recvAt}</td><td>${r.rawTs}</td>
      <td>${r.fw}</td>
      <td>${r.lat}</td><td>${r.lon}</td><td>${r.alt}</td><td>${r.hdop}</td><td>${r.speed}</td><td>${r.head}</td>
      <td>${r.rssi}</td><td>${r.rsrp}</td><td>${r.rsrq}</td><td>${r.sinr}</td><td>${r.rat}</td>
      <td>${r.ip}</td><td>${r.rtt}</td>
      <td>${r.cpuT}</td><td>${r.mem}</td><td>${r.disk}</td><td>${r.up}</td>
      <td>${r.pps}</td><td>${r.tsync}</td>
      <td>${r.cert}</td><td>${r.certExp}</td>
      <td>${r.health}</td><td>${r.flags}</td>
    </tr>`).join("");

  const css = `
    <style>
      * { box-sizing: border-box; }
      body { font: 12px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
      h1 { font-size: 18px; margin: 0 0 6px; }
      .meta { margin: 0 0 12px; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
      th { background: #f4f6f8; position: sticky; top: 0; }
      tr:nth-child(even) td { background: #fafbfc; }
      @media print {
        body { margin: 0; }
        .no-print { display: none !important; }
        th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      .toolbar { margin: 8px 0 12px; }
      .toolbar button { padding: 6px 10px; }
    </style>
  `;

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>RSE 점검 보고서</title>
${css}
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">인쇄</button>
  </div>
  <h1>RSE 점검 보고서</h1>
  <div class="meta">
    점검 시작: <b>${startedAt}</b> &nbsp; | &nbsp;
    점검 종료: <b>${endedAt}</b> &nbsp; | &nbsp;
    대상 장치 수: <b>${rows.length}</b>
  </div>
  <table>
    <thead>
      <tr>
        <th>장치ID</th><th>시리얼</th>
        <th>수신시각</th><th>원본TS</th>
        <th>펌웨어</th>
        <th>위도</th><th>경도</th><th>고도</th><th>HDOP</th><th>속도</th><th>방향</th>
        <th>RSSI</th><th>RSRP</th><th>RSRQ</th><th>SINR</th><th>RAT</th>
        <th>IP</th><th>MQTT RTT</th>
        <th>CPU온도</th><th>메모리</th><th>디스크</th><th>업타임</th>
        <th>1PPS</th><th>TimeSync</th>
        <th>인증서</th><th>만료일</th>
        <th>Health</th><th>플래그</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="28" style="text-align:center;">데이터 없음</td></tr>`}
    </tbody>
  </table>

  <script>
    // 새 창이 열리자마자 자동 프린트 (유저가 취소하면 그냥 창만 닫음)
    window.addEventListener('load', () => {
      setTimeout(() => { try { window.print(); } catch(e){} }, 50);
    });
  </script>
</body>
</html>`;
}

export function openRseReportPrint(latestItems, meta) {
  const html = buildRseReportHTML(latestItems, meta);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  // 열리지 못한 경우도 있으니 URL 해제는 조금 지연
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
}
