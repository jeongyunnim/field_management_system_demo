// src/utils/signal.js
export function rssiToBars(rssi) {
    if (rssi == null) return 1;
    if (rssi >= -55) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -75) return 2;
    return 1;
  }
  
  export function rssiToColor(rssi) {
    const bars = rssiToBars(rssi);
    return bars >= 4 ? "#22c55e" : bars >= 3 ? "#84cc16" : bars >= 2 ? "#f59e0b" : "#ef4444";
  }