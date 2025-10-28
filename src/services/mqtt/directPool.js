import { logEvent } from "../../core/logger";
import mqtt from "mqtt";
import { extractDeviceIp, generateTransactionId } from "../../utils/deviceUtils";

/* -------------------- 연결 & 세션 -------------------- */

/**
 * 단일 MQTT 클라이언트 연결
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
   */
  rpcJson({ reqTopic, resTopic, payload, match, timeoutMs = 6000, qos = 1 }) {
    this.touch();
    
    return new Promise(async (resolve, reject) => {
      let timer;

      const handleMessage = (topic, message) => {
        if (topic !== resTopic) {
          return;
        }

        try {
          const response = JSON.parse(message.toString());

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
          }
        } catch (error) {
          console.error("Failed to parse RPC response:", error);
        }
      };

      try {
        // 구독
        await new Promise((res, rej) =>
          this.client.subscribe(resTopic, { qos }, (error) => {
            if (error) {
              rej(error);
            } else {
              res();
            }
          })
        );

        // 메시지 핸들러 등록
        this.client.on("message", handleMessage);

        // 타임아웃 타이머
        timer = setTimeout(() => {
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
        await this.publishJson(reqTopic, payload, { qos });
        
      } catch (error) {
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
 */
export async function publishDirect({ pktOrIp, topic, payload, qos = 1, retain = false }) {
  const session = await getDirectSession(pktOrIp);
  return session.publishJson(topic, payload, { qos, retain });
}

/**
 * RPC 호출 (요청-응답)
 */
export async function rpcDirect({ pktOrIp, reqTopic, resTopic, payload, match, timeoutMs = 6000, qos = 1 }) {
  const session = await getDirectSession(pktOrIp);
  return session.rpcJson({ reqTopic, resTopic, payload, match, timeoutMs, qos });
}

/* -------------------- OTA 전용 함수 -------------------- */

/**
 * RSE 버전 정보 조회 (재시도 포함)
 * @param {string|object} pktOrIp - 장치 IP 또는 패킷
 * @param {number} maxRetries - 최대 재시도 횟수 (기본 3회)
 * @returns {Promise<object>} 버전 정보 응답
 */
export async function requestDeviceVersionWithRetry(pktOrIp, maxRetries = 3) {
  const ip = extractDeviceIp(pktOrIp);
  
  logEvent({
    level: "INFO",
    source: "OTA",
    entity: ip,
    event: "VERSION_CHECK_START",
    message: "Starting version check with retry",
    details: { maxRetries },
  });

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await rpcDirect({
        pktOrIp,
        reqTopic: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SW_UPDATE_MGMT_PA/swLocalRegistry/req",
        resTopic: "fac/SW_UPDATE_MGMT_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/swLocalRegistry/resp",
        payload: {},
        timeoutMs: 5000,
        qos: 1,
      });

      logEvent({
        level: "INFO",
        source: "OTA",
        entity: ip,
        event: "VERSION_CHECK_SUCCESS",
        message: `Version check succeeded on attempt ${attempt}`,
        details: { attempt, entryCount: response.entry_count },
      });

      return response;
    } catch (error) {
      lastError = error;
      
      logEvent({
        level: "WARN",
        source: "OTA",
        entity: ip,
        event: "VERSION_CHECK_RETRY",
        message: `Version check attempt ${attempt} failed`,
        details: { attempt, maxRetries, error: String(error) },
      });

      if (attempt < maxRetries) {
        // 재시도 전 대기 (지수 백오프)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // 모든 재시도 실패
  logEvent({
    level: "ERROR",
    source: "OTA",
    entity: ip,
    event: "VERSION_CHECK_FAIL",
    message: "Version check failed after all retries",
    details: { maxRetries, error: String(lastError) },
  });

  throw lastError;
}

/**
 * RSE 업데이트 수행
 * @param {string|object} pktOrIp - 장치 IP 또는 패킷
 * @param {object} updateRequest - 업데이트 요청 객체
 * @returns {Promise<object>} 업데이트 응답
 */
export async function performDeviceUpdate(pktOrIp, updateRequest) {
  const ip = extractDeviceIp(pktOrIp);
  
  logEvent({
    level: "INFO",
    source: "OTA",
    entity: ip,
    event: "UPDATE_REQUEST",
    message: "Sending update request",
    details: { 
      transactionId: updateRequest.transaction_id,
      fileCount: updateRequest.entries?.length || 0 
    },
  });

  try {
    const response = await rpcDirect({
      pktOrIp,
      reqTopic: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SW_UPDATE_MGMT_PA/swUpdate/req",
      resTopic: "fac/SW_UPDATE_MGMT_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/swUpdate/resp",
      payload: updateRequest,
      match: (resp) => resp?.entries?.code == 200,
      timeoutMs: 300000, // 300초 (파일 전송 시간 고려)
      qos: 1,
    });

    logEvent({
      level: "INFO",
      source: "OTA",
      entity: ip,
      event: "UPDATE_RESPONSE",
      message: "Update response received",
      details: { 
        transactionId: response.transaction_id,
        entries: response.entries 
      },
    });

    return response;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA",
      entity: ip,
      event: "UPDATE_FAIL",
      message: "Update request failed",
      details: { error: String(error) },
    });
    throw error;
  }
}

/**
 * RSE 재부팅 요청
 * @param {string|object} pktOrIp - 장치 IP 또는 패킷
 * @returns {Promise<object>} 재부팅 응답
 */
export async function requestDeviceReboot(pktOrIp) {
  const ip = extractDeviceIp(pktOrIp);
  
  logEvent({
    level: "INFO",
    source: "OTA",
    entity: ip,
    event: "REBOOT_REQUEST",
    message: "Sending reboot request",
  });

  try {
    const response = await rpcDirect({
      pktOrIp,
      reqTopic: "fac/V2X_MAINTENANCE_HUB_CLIENT_PA/SYS_CTRL_PA/systemRestart/req",
      resTopic: "fac/SYS_CTRL_PA/V2X_MAINTENANCE_HUB_CLIENT_PA/systemRestart/resp",
      payload: {
        VER: "1.0",
        TRANSACTION_ID: generateTransactionId(),
        REASON: "Maintenance reboot"
      },
      timeoutMs: 5000,
      qos: 1,
    });

    logEvent({
      level: "INFO",
      source: "OTA",
      entity: ip,
      event: "REBOOT_SUCCESS",
      message: "Reboot request succeeded",
    });

    return response;
  } catch (error) {
    logEvent({
      level: "ERROR",
      source: "OTA",
      entity: ip,
      event: "REBOOT_FAIL",
      message: "Reboot request failed",
      details: { error: String(error) },
    });
    throw error;
  }
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