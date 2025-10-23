import { useEventLogStore } from "../stores/EventListStore";

function now() { return Date.now(); }

/**
 * @param {Object} e
 * @param {"INFO"|"WARN"|"ERROR"} e.level
 * @param {"APP"|"MQTT"|"BUS"|"DIRECT"|"FMS"|"RSE"} e.source
 * @param {string} [e.entity]  // 예: serial, deviceId, "FMS"
 * @param {string} e.event     // 예: "MQTT_CONNECTED", "RSE_STATUS_UPSERT", "RPC_TIMEOUT"
 * @param {string} [e.message]
 */
export function logEvent(e) {
  try {
    const entry = { ts: now(), ...e };
    useEventLogStore.getState().push(entry);
  } catch (err) {
    console.warn("[logEvent] failed", err, e);
  }
}
