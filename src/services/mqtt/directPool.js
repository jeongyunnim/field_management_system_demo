import { logEvent } from "../../core/logger";
import mqtt from "mqtt";
import { extractDeviceIp } from "../../utils/deviceUtils";

/* -------------------- 연결 & 세션 -------------------- */

/**
 * 단일 MQTT 클라이언트 연결
 * @param {string} url - MQTT 브로커 URL
 * @param {object} options - 연결 옵션
 * @returns {Promise<mqtt.Client>} 연결된 MQTT 클라이언트
 */
async function connectOne(url, { 
  connectTimeout = 5000, 
  keepalive = 30, 
  reconnectPeriod = 2000 
} = {}) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, { connectTimeout, keepalive, reconnectPeriod });
    
    const handleConnect = () => {
      cleanup();
      resolve(client);
      logEvent({
        level: "INFO",
        source: "DIRECT",
        event: "DIRECT_CONNECTED",
        message: `Connected to ${url}`,
      });
    };

    const handleError = (error) => {
      cleanup();
      try {
        client.end(true);
      } catch {}
      reject(error);
    };

    const cleanup = () => {
      client.off("connect", handleConnect);
      client.off("error", handleError);
    };

    client.once("connect", handleConnect);
    client.once("error", handleError);
  });
}

/**
 * IP 주소로 MQTT 연결 시도
 * @param {string} ip - 장치 IP 주소
 * @param {object} opts - 연결 옵션
 * @returns {Promise<{client: mqtt.Client, url: string}>}
 */
async function connectWithFallback(ip, opts = {}) {
  const url = `ws://${ip}:9001`;
  
  try {
    const client = await connectOne(url, opts);
    return { client, url };
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "DIRECT",
      entity: ip,
      event: "DIRECT_CONNECT_FAIL",
      message: "Direct MQTT connect failed",
      details: { url, error: String(error) },
    });
    throw error ?? new Error(`Direct MQTT connect failed: ${ip}`);
  }
}

/**
 * DirectSession 클래스 - MQTT 세션 관리
 */
class DirectSession {
  constructor(ip, client, url) {
    this.ip = ip;
    this.client = client;
    this.url = url;
    this.lastUsed = Date.now();
  }

  touch() {
    this.lastUsed = Date.now();
  }

  /**
   * JSON 페이로드 발행
   * @param {string} topic - MQTT 토픽
   * @param {object} payload - 발행할 데이터
   * @param {object} options - 발행 옵션
   * @returns {Promise<void>}
   */
  publishJson(topic, payload, { qos = 1, retain = false } = {}) {
    this.touch();
    return new Promise((resolve, reject) => {
      try {
        this.client.publish(
          topic,
          JSON.stringify(payload),
          { qos, retain },
          (error) => {
            if (error) {
              logEvent({
                level: "ERROR",
                source: "DIRECT",
                entity: this.ip,
                event: "DIRECT_PUBLISH_FAIL",
                message: `Publish failed: ${topic}`,
                details: { error: String(error) },
              });
              reject(error);
            } else {
              logEvent({
                level: "INFO",
                source: "DIRECT",
                entity: this.ip,
                event: "DIRECT_PUBLISH_OK",
                message: `Publish success: ${topic}`,
              });
              resolve();
            }
          }
        );
      } catch (error) {
        logEvent({
          level: "ERROR",
          source: "DIRECT",
          entity: this.ip,
          event: "DIRECT_PUBLISH_THROW",
          message: `Publish threw: ${topic}`,
          details: { error: String(error) },
        });
        reject(error);
      }
    });
  }

  /**
   * RPC 호출 (요청-응답 패턴)
   * @param {object} params - RPC 파라미터
   * @param {string} params.reqTopic - 요청 토픽
   * @param {string} params.resTopic - 응답 토픽
   * @param {object} params.payload - 요청 페이로드
   * @param {function} params.match - 응답 매칭 함수
   * @param {number} params.timeoutMs - 타임아웃 (ms)
   * @param {number} params.qos - QoS 레벨
   * @returns {Promise<object>} 응답 객체
   */
  rpcJson({ reqTopic, resTopic, payload, match, timeoutMs = 6000, qos = 1 }) {
    this.touch();
    
    console.log("=== rpcJson called ===");
    console.log("reqTopic:", reqTopic);
    console.log("resTopic:", resTopic);
    console.log("payload:", payload);
    
    return new Promise(async (resolve, reject) => {
      let timer;

      const handleMessage = (topic, message) => {
        console.log("=== Message received ===");
        console.log("Topic:", topic);
        console.log("Expected resTopic:", resTopic);
        console.log("Match:", topic === resTopic);
        
        if (topic !== resTopic) {
          console.log("Topic mismatch - ignoring");
          return;
        }

        try {
          const response = JSON.parse(message.toString());
          console.log("=== Parsed Response ===", response);

          if (!match || match(response)) {
            clearTimeout(timer);
            this.client.off("message", handleMessage);
            this.client.unsubscribe(resTopic, () => {});
            
            logEvent({
              level: "INFO",
              source: "DIRECT",
              entity: this.ip,
              event: "DIRECT_RPC_OK",
              message: `RPC matched: ${resTopic}`,
            });
            
            resolve(response);
          } else {
            console.log("=== RPC Response match failed ===", { 
              response, 
              matchResult: match(response) 
            });
          }
        } catch (error) {
          console.error("Failed to parse RPC response:", error);
          console.error("Raw message:", message.toString());
        }
      };

      try {
        // 구독
        console.log("Subscribing to:", resTopic);
        await new Promise((res, rej) =>
          this.client.subscribe(resTopic, { qos }, (error) => {
            if (error) {
              console.error("Subscribe error:", error);
              rej(error);
            } else {
              console.log("Subscribe success:", resTopic);
              res();
            }
          })
        );

        // 메시지 핸들러 등록
        this.client.on("message", handleMessage);
        console.log("Message handler registered");

        // 타임아웃 타이머
        timer = setTimeout(() => {
          console.log("=== RPC Timeout ===");
          this.client.off("message", handleMessage);
          this.client.unsubscribe(resTopic, () => {});
          
          logEvent({
            level: "WARN",
            source: "DIRECT",
            entity: this.ip,
            event: "DIRECT_RPC_TIMEOUT",
            message: `RPC timeout: ${resTopic}`,
            details: { reqTopic, timeoutMs },
          });
          
          reject(new Error(`RPC timeout: ${resTopic} (waited ${timeoutMs}ms)`));
        }, timeoutMs);

        // 요청 발행
        console.log("Publishing to:", reqTopic);
        await this.publishJson(reqTopic, payload, { qos });
        console.log("Publish success");
        
      } catch (error) {
        console.error("=== RPC Flow Error ===", error);
        clearTimeout(timer);
        this.client.off("message", handleMessage);
        try {
          this.client.unsubscribe(resTopic, () => {});
        } catch {}
        
        logEvent({
          level: "ERROR",
          source: "DIRECT",
          entity: this.ip,
          event: "DIRECT_RPC_FAIL",
          message: "RPC flow failed",
          details: { error: String(error), reqTopic, resTopic },
        });
        
        reject(error);
      }
    });
  }

  close() {
    try {
      this.client.end(true);
    } catch {}
  }
}

/* -------------------- 세션 풀 -------------------- */

const sessionPool = new Map(); // ip -> Promise<DirectSession>
let gcTimer = null;
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2분

/**
 * 가비지 컬렉션 시작
 */
function startGarbageCollection() {
  if (gcTimer) return;

  gcTimer = setInterval(() => {
    const now = Date.now();
    
    for (const [ip, sessionPromise] of sessionPool.entries()) {
      Promise.resolve(sessionPromise)
        .then((session) => {
          if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
            session.close();
            sessionPool.delete(ip);
            logEvent({
              level: "INFO",
              source: "DIRECT",
              entity: ip,
              event: "SESSION_CLEANED",
              message: "Idle session cleaned up",
            });
          }
        })
        .catch(() => sessionPool.delete(ip));
    }
  }, 30000); // 30초마다 체크
}

/**
 * 세션 가져오기 (없으면 새로 생성)
 * @param {string|object} pktOrIp - IP 문자열 또는 패킷 객체
 * @returns {Promise<DirectSession>}
 */
export async function getDirectSession(pktOrIp) {
  const ip = extractDeviceIp(pktOrIp);
  
  if (!ip) {
    throw new Error("Device IP required (unable to extract from packet)");
  }

  startGarbageCollection();

  if (!sessionPool.has(ip)) {
    sessionPool.set(
      ip,
      (async () => {
        const { client, url } = await connectWithFallback(ip);
        return new DirectSession(ip, client, url);
      })()
    );
  }

  return sessionPool.get(ip);
}

/* -------------------- 편의 헬퍼 함수 -------------------- */

/**
 * 장치로 직접 메시지 발행
 * @param {object} params - 발행 파라미터
 * @returns {Promise<void>}
 */
export async function publishDirect({ pktOrIp, topic, payload, qos = 1, retain = false }) {
  const session = await getDirectSession(pktOrIp);
  return session.publishJson(topic, payload, { qos, retain });
}

/**
 * RPC 호출 (요청-응답)
 * @param {object} params - RPC 파라미터
 * @returns {Promise<object>}
 */
export async function rpcDirect({ pktOrIp, reqTopic, resTopic, payload, match, timeoutMs = 6000, qos = 1 }) {
  const session = await getDirectSession(pktOrIp);
  return session.rpcJson({ reqTopic, resTopic, payload, match, timeoutMs, qos });
}

/**
 * 세션 풀 종료
 */
export function shutdownDirectPool() {
  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }

  for (const [ip, sessionPromise] of sessionPool.entries()) {
    Promise.resolve(sessionPromise)
      .then((session) => session.close())
      .catch(() => {});
  }

  sessionPool.clear();
  
  logEvent({
    level: "INFO",
    source: "DIRECT",
    event: "POOL_SHUTDOWN",
    message: "Direct session pool shut down",
  });
}