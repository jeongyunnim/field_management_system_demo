// utils/rseTransform.js

// --- HDOP → 0~4 막대 ---
function hdopToBars(hdop) {
  const v = Number(hdop);
  if (!Number.isFinite(v)) return 0;
  if (v <= 0.8) return 4;
  if (v <= 1.5) return 3;
  if (v <= 3.0) return 2;
  if (v <= 6.0) return 1;
  return 0;
}

// --- HDOP → "dBm풍" 숫자 (임시 시각화용) ---
function hdopToDbm(hdop) {
  const v = Number(hdop);
  if (!Number.isFinite(v)) return null;
  const clamped = Math.min(Math.max(v, 0), 6);
  const score = -120 + Math.round((6 - clamped) * 10); // 0.8≈-60, 1.5≈-70, 3≈-90, 6≈-110
  return Math.max(-120, Math.min(-50, score));
}

// --- Health(0~100): HW 60 + CPU/MEM/DISK/TEMP 각 10 - 1PPS 패널티 ---
function computeHealth(m) {
  const ok = (x) => (x ? 1 : 0);

  const hwScore =
    ok(m.gnss_antenna_status) +
    ok(m.ltev2x_antenna1_status) +
    ok(m.ltev2x_antenna2_status) +
    ok(m.v2x_usb_status) +
    ok(m.v2x_spi_status) +
    ok(m.sram_vbat_status);
  const hwPct = (hwScore / 6) * 60;

  const cpu = Number(m?.cpu_usage_status?.cpu_usage_total_percent);
  const cpuPct = Number.isFinite(cpu) ? Math.max(0, 100 - cpu) : 0;

  const mem = Number(m?.memory_usage_status?.memory_usage_percent);
  const memPct = Number.isFinite(mem) ? Math.max(0, 100 - mem) : 0;

  const disk = Number(m?.storage_usage_status?.storage_usage_percent);
  const diskPct = Number.isFinite(disk) ? Math.max(0, 100 - disk) : 0;

  const t = Number(m?.temperature_status?.temperature_celsius);
  const tempPenalty = Number.isFinite(t)
    ? (t <= 40 ? 0 : (t >= 80 ? 40 : ((t - 40) / 40) * 40))
    : 20; // 측정치 없으면 약간 감점
  const tempPct = Math.max(0, 40 - tempPenalty);

  const ppsPenalty = m?.secton_1pps_status ? 0 : 10;

  const score =
    hwPct +
    cpuPct * 0.10 +
    memPct * 0.10 +
    diskPct * 0.10 +
    tempPct * 0.10 -
    ppsPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- 인증서 D-day (2004-01-01 epoch 고정) ---
function certDaysLeft2004(endSec) {
  const end = Number(endSec);
  if (!Number.isFinite(end)) return null;
  const epoch2004 = Date.UTC(2004, 0, 1);     // ms
  const now = Date.now();                     // ms
  return Math.ceil((epoch2004 + end * 1000 - now) / 86400000);
}

// --- 좌표 스케일 해제 ---
function pickCoords(m) {
  const latScaled = Number(m?.gnss_data?.latitude);
  const lonScaled = Number(m?.gnss_data?.longitude);
  if (Number.isFinite(latScaled) && Number.isFinite(lonScaled)) {
    return { lat: latScaled / 1e7, lon: lonScaled / 1e7 };
  }
  return null;
}

// --- 메인 변환기: 원본 RSE JSON → 화면에서 바로 쓰는 아이템 ---
export function rseToItem(m) {
  const serial = String(m?.serial_number ?? "");
  const hdop = Number(m?.gnss_data?.hdop);

  const health = computeHealth(m);
  const bars = hdopToBars(hdop);
  // TODO: 차후 실제 값으로 바인딩 해야 함.
  const signalDbm =  75;
  const certDaysLeft = certDaysLeft2004(m?.certificate?.ltev2x_cert_valid_end);

  const cpu = Number(m?.cpu_usage_status?.cpu_usage_total_percent);
  const mem = Number(m?.memory_usage_status?.memory_usage_percent);
  const disk = Number(m?.storage_usage_status?.storage_usage_percent);
  const t = Number(m?.temperature_status?.temperature_celsius);

  return {
    // 식별/표시
    id: serial,
    serial,

    // 요약 UI 필드
    active: !!(m?.ltev2x_tx_ready_status || m?.gnss_antenna_status),
    health,                 // 0~100 (도넛)
    bars,                   // 0~4   (막대)
    signalDbm,              // null 또는 숫자 (라벨 "dBm")
    securityEnabled: !!m?.certificate?.ltev2x_cert_status_security_enable,
    certDaysLeft,           // null | 0.. | 음수(만료 경과)

    // 지도/리소스(optional)
    coords: pickCoords(m),
    temperatureC: Number.isFinite(t) ? t : null,
    cpuTotalPct: Number.isFinite(cpu) ? cpu : null,
    memUsedPct: Number.isFinite(mem) ? mem : null,
    diskUsedPct: Number.isFinite(disk) ? disk : null,

    // 메타
    updatedAt: Date.now(),
    __raw: m,               // 원본 보관 (디버그/추가 표시)
  };
}
