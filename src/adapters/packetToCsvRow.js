// src/adapters/packetToCsvRow.js
import { toIso, epochSecToDateAuto, fromUtcPartsMs, N, B } from "../utils/csvHelpers";

export const CSV_HEADER = [
  "serial","recv_at","device_ts","hw_version","os_version","fw_version",
  // hardware quick-checks
  "gnss_antenna_ok","ltev2x_ant1_ok","ltev2x_ant2_ok","pps_sync",
  "temp_ok","v2x_usb_ok","v2x_spi_ok","sram_vbat_ok",
  "ltev2x_tx_ready",
  // summary hardware percent
  "hardware_health_pct",

  // cpu / memory / storage
  "cpu_total_pct","cpu_core_0_pct","cpu_core_1_pct","cpu_core_2_pct","cpu_core_3_pct",
  "mem_used_pct","mem_total_mb","mem_used_mb",
  "storage_used_pct","storage_total_gb","storage_used_gb",

  // cert
  "cert_security_enable","cert_valid_start","cert_valid_end",

  // location
  "lat","lon","alt_m","speed_kmh","heading_deg",
  "pdop","hdop","vdop","hacc_m","vacc_m","pacc",
  "num_sats","num_sats_used",
  "ecef_x","ecef_y","ecef_z",

  // network
  "primary_ip","eth0_ip","ltev2x0_ip",
];

export function packetToCsvRow(pkt, recvAtMs = Date.now()) {
    const g = pkt?.gnss_data ?? {};
    const mem = pkt?.memory_usage_status ?? {};
    const stor = pkt?.storage_usage_status ?? {};
    const cpu = pkt?.cpu_usage_status ?? {};
    const cert = pkt?.certificate ?? {};

    // device timestamp from parts if present
    const deviceTsMs = fromUtcPartsMs({
        y: g.year, m: g.month, d: g.day, hh: g.hour, mm: g.min, ss: g.sec
    });
    const device_ts = Number.isFinite(deviceTsMs) ? toIso(deviceTsMs) : "";

    // cert epoch auto -> ISO
    const certStartMs = epochSecToDateAuto(cert?.ltev2x_cert_valid_start);
    const certEndMs   = epochSecToDateAuto(cert?.ltev2x_cert_valid_end);

    const lat = Number.isFinite(g.latitude) ? (g.latitude / 1e7) : NaN;
    const lon = Number.isFinite(g.longitude) ? (g.longitude / 1e7) : NaN;

    const alt_m = Number.isFinite(g.altMSL) ? Number(g.altMSL) / 100.0 : NaN; // cm -> m
    const speedKmh = Number.isFinite(g.speed) ? Number(g.speed) * 0.036 : NaN; // cm/s -> km/h
    const headingDeg = Number.isFinite(g.heading) ? Number(g.heading) / 100.0 : NaN;

    // cpu cores array -> split
    const cores = Array.isArray(cpu?.cpu_usage_core_percent) ? cpu.cpu_usage_core_percent : [];
    const coreCols = {
        cpu_core_0_pct: N(cores[0], 3),
        cpu_core_1_pct: N(cores[1], 3),
        cpu_core_2_pct: N(cores[2], 3),
        cpu_core_3_pct: N(cores[3], 3),
    };

    let primary_ip = "";
    let eth0_ip = "";
    let ltev2x0_ip = "";
    if (Array.isArray(pkt.interface_info?.interface_array)) {
        for (const iface of pkt.interface_info.interface_array) {
            if (!primary_ip && iface.ip_addr && iface.ip_addr !== "127.0.0.1") primary_ip = iface.ip_addr;
            if (iface.name === "eth0") eth0_ip = iface.ip_addr ?? eth0_ip;
            if (iface.name === "ltev2x0") ltev2x0_ip = iface.ip_addr ?? ltev2x0_ip;
        }
    }
    return {
        // system version info
        serial: pkt?.serial_number ?? "",
        recv_at: toIso(recvAtMs),
        device_ts,
        hw_version: pkt?.hardware_version ?? "",
        os_version: pkt?.os_version ?? "",
        fw_version: pkt?.firmware_version ?? "",

        // gnss
        lat: N(lat, 7),
        lon: N(lon, 7),
        alt_m: N(g?.altMSL),
        hdop: N(g?.hdop, 6),
        speed_kmh: N(speedKmh, 1),
        heading_deg: N(headingDeg, 2),

        cpu_total_pct: N(cpu?.cpu_usage_total_percent, 3),
        mem_used_pct: N(mem?.memory_usage_percent, 3),
        storage_used_pct: N(stor?.storage_usage_percent, 3),

        cert_valid_start: Number.isFinite(certStartMs) ? toIso(certStartMs) : "",
        cert_valid_end:   Number.isFinite(certEndMs)   ? toIso(certEndMs)   : "",

        num_sats: N(g?.numSatellites),
        num_sats_used: N(g?.numUsedSatellites),

        gnss_antenna_ok: B(pkt.gnss_antenna_status),
        ltev2x_ant1_ok: B(pkt.ltev2x_antenna1_status),
        ltev2x_ant2_ok: B(pkt.ltev2x_antenna2_status),
        pps_sync: B(pkt.secton_1pps_status),

        temp_ok: B(pkt.temperature_status?.temperature_status),
        temp_c: N(pkt.temperature_status?.temperature_celsius, 1),

        cpu_total_pct: N(cpu?.cpu_usage_total_percent, 3),
        ...coreCols,

        mem_used_pct: N(mem?.memory_usage_percent, 3),
        mem_total_mb: N(mem?.memory_usage_total_mb),
        mem_used_mb: N(mem?.memory_usage_used_mb),

        storage_used_pct: N(stor?.storage_usage_percent, 3),
        storage_total_gb: N(stor?.storage_usage_total_gb, 6),
        storage_used_gb: N(stor?.storage_usage_used_gb, 6),

        tamper_secure: B(pkt.tamper_secure_status),
        v2x_tx_ready: B(pkt.ltev2x_tx_ready_status),

        cert_security_enable: B(cert?.ltev2x_cert_status_security_enable),
        cert_valid_start: Number.isFinite(certStartMs) ? toIso(certStartMs) : "",
        cert_valid_end:   Number.isFinite(certEndMs)   ? toIso(certEndMs)   : "",

        lat: N(lat, 7),
        lon: N(lon, 7),
        alt_m: N(alt_m, 3),
        speed_kmh: N(speedKmh, 3),
        heading_deg: N(headingDeg, 2),

        pdop: N(g?.pdop, 3),
        hdop: N(g?.hdop, 3),
        vdop: N(g?.vdop, 3),
        hacc_m: N(g?.hacc, 3),
        vacc_m: N(g?.vacc, 3),
        pacc: N(g?.pacc, 3),

        num_sats: N(g?.numSatellites),
        num_sats_used: N(g?.numUsedSatellites),

        ecef_x: N(g?.ecef_x),
        ecef_y: N(g?.ecef_y),
        ecef_z: N(g?.ecef_z),

        primary_ip, eth0_ip, ltev2x0_ip,
    };
}
