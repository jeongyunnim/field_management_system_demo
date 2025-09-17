import { create } from "zustand";
import mqtt from "mqtt";

/**
 * [TODO]: jeseo, publish 타임아웃, 횟수 제어 로직 확인
 */

export const useMqttStore = create(() => {
  // 내부 리스너 & 구독목록 (스토어 외부로 노출하지 않음)
  const listeners = new Set();                              // Set<(topic, msg, packet) => void>
  const subs = new Map();                                   // Map<string, { qos?: 0|1|2 }>
  let client = null;

  const subscribeAll = () => {
    if (!client || !client.connected) 
    {
      console.warn("client error");
      return;
    }
    for (const [topic, opts] of subs.entries()) {
      console.log("sub topic: ", topic);
      client.subscribe(topic, opts || {}, (err) => {
        if (err) console.error("subscribe error:", topic, err);
      });
    }
  };

  const api = {
    connected: false,

    connect(url = "ws://192.168.123.129:9001", options = { reconnectPeriod: 5000 }) {
      if (client) return; // 중복 연결 방지
      client = mqtt.connect(url, options);

      client.on("connect", () => {
        api.setState({ connected: true });
        // 재연결 포함: 누적된 구독 요청 재적용
        subscribeAll();
        console.log("[mqttStore] connected");
      });

      client.on("reconnect", () => {
        console.log("[mqttStore] reconnecting...");
      });

      client.on("close", () => {
        api.setState({ connected: false });
        console.log("[mqttStore] closed");
      });

      client.on("error", (err) => {
        console.error("[mqttStore] error:", err);
      });

      client.on("message", (topic, message, packet) => {
        for (const fn of listeners) {
          try { fn(topic, message, packet); }
          catch (e) { console.error("listener error:", e); }
        }
      });
    },

    disconnect() {
      try {
        if (client) {
          client.end(true);
          client = null;
        }
      } catch (e) {
        console.warn("[mqttStore] disconnect error:", e);
      }
      listeners.clear();
      subs.clear();
      api.setState({ connected: false });
    },

    publish(topic, payload, opts = {}) {
      console.log("publish ", payload);
      if (!client || !client.connected) {
        console.warn("[mqttStore] publish skipped (not connected):", topic);
        return false;
      }
      const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
      client.publish(topic, msg, opts, (err) => {
        if (err) console.error("publish error:", err);
      });
      return true;
    },

    subscribeTopics(topics, defaultOpts = { qos: 0 }) {
      const list = Array.isArray(topics) ? topics : [];
      for (const t of list) {
        if (typeof t === "string") {
          subs.set(t, defaultOpts);
        } else if (t && typeof t.topic === "string") {
          subs.set(t.topic, { qos: 0, ...(t.opts || {}) });
        }
      }
      // 연결돼 있다면 즉시 적용, 아니면 큐잉되어 connect 시 일괄 적용
      subscribeAll();
    },

    unsubscribeTopics(topics) {
      const list = Array.isArray(topics) ? topics : [];
      for (const t of list) {
        const topic = typeof t === "string" ? t : t?.topic;
        if (!topic) continue;
        subs.delete(topic);
        if (client && client.connected) {
          client.unsubscribe(topic, (err) => {
            if (err) console.error("unsubscribe error:", topic, err);
          });
        }
      }
    },

    addMessageHandler(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // zustand setState 접근자
    setState(partial) {
      const set = useMqttStore.setState; // zustand의 setState
      set(partial);
    },
  };

  return api;
});
