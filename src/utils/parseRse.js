// utils/parseRse.js
function toNum(v){ if(v==null) return; const n=typeof v==="number"?v:Number(v); return isFinite(n)?n:undefined; }

export function parseRsePacket(input){
  if(!input || typeof input!=="object") return null;
  const d=input;

  const rseStatus={
    txReady: !!d.cv2x_tx_ready,
    freqMHz: toNum(d.frequency_mhz) ?? 0,
    bwMHz: toNum(d.channel_bandwidth_mhz) ?? 0,
    txTotal: toNum(d.ltev2x_tx_total_count) ?? 0,
    rxTotal: toNum(d.ltev2x_rx_total_count) ?? 0,
  };

  const g=d.gnss_data || {};
  const lat=toNum(g.latitude), lon=toNum(g.longitude);
  const normLat=lat==null?null:(Math.abs(lat)>1000?lat/1e7:lat);
  const normLon=lon==null?null:(Math.abs(lon)>1000?lon/1e7:lon);
  const speed_mps=g.speed==null?null:g.speed/10;
  const heading_deg=g.heading==null?null:g.heading/10;

  const iso=new Date(Date.UTC(
    g.year ?? 1970, (g.month ?? 1)-1, g.day ?? 1,
    g.hour ?? 0, g.min ?? 0, g.sec ?? 0, Math.floor((g.nanosec ?? 0)/1e6)
  )).toISOString();

  const gnss={
    lat:normLat, lon:normLon,
    altHAE_m: toNum(g.altHAE) ?? null,
    altMSL_m: toNum(g.altMSL) ?? null,
    speed_mps, heading_deg,
    satsTracked: toNum(g.numSatellites) ?? 0,
    satsUsed: toNum(g.numUsedSatellites) ?? 0,
    pdop: toNum(g.pdop), hdop: toNum(g.hdop), vdop: toNum(g.vdop),
    hacc_m: toNum(g.hacc), vacc_m: toNum(g.vacc),
    timestamp: iso,
  };

  return { rseStatus, gnss };
}
