// src/components/MonitoringDeviceList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { countDb } from "../../deprecated/v2x_count_db";
import { deviceDb } from "../../dbms/device_db";
import Donut, { healthColorForPct } from "../common/Donut";
import Led from "../common/Led";
import SignalBars from "../common/SignalBars";
import { rssiToBars } from "../../utils/signal";

export default function MonitoringDeviceList({
  onStatusUpdate,        // 지도/상태 반영 (기존)
  onSelect,              // 상단 패널에 반영
  selectedId,            // 현재 선택된 l2id
  className = "",
}) {
  const [items, setItems] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const tick = async () => {
      try {
        const [counts, deviceList] = await Promise.all([
          countDb.counts.toArray(),
          deviceDb.devices.toArray(),
        ]);
        const now = Date.now();
        const devByL2 = new Map(deviceList.map(d => [String(d.l2id), d]));

        // l2idSrc → aggregate
        const agg = new Map();
        for (const entry of counts) {
          const { l2idSrc, psid, count, lastUpdated, lastRssi } = entry || {};
          if (l2idSrc == null) continue;
          const key = String(l2idSrc);
          if (!agg.has(key)) agg.set(key, { l2id: key, psidCount: {}, recentCount: 0, lastRssi: null, lastUpdated: 0 });
          const g = agg.get(key);

          if (psid) g.psidCount[psid] = (g.psidCount[psid] || 0) + (count || 0);
          if (typeof lastRssi === "number") g.lastRssi = lastRssi;
          if (lastUpdated) g.lastUpdated = Math.max(g.lastUpdated, lastUpdated);
          if (now - (lastUpdated || 0) <= 1000) g.recentCount += 1;
        }

        // map → array
        const list = [...agg.values()].map(g => {
          const dev = devByL2.get(g.l2id);
          const serial = dev?.serial || dev?.model || `serial ${g.l2id}`;
          const active = g.recentCount > 0 || (now - g.lastUpdated) < 5_000;
          const rssi = typeof g.lastRssi === "number" ? g.lastRssi : null;
          const health = estimateHealth({ rssi, recent: g.recentCount }); // 0~100
          return {
            id: g.l2id,
            l2id: g.l2id,
            serial,
            ipv4: dev?.ipv4 ?? "-",
            msgPerSec: g.recentCount,
            psidCount: g.psidCount,
            rssi,
            bars: rssiToBars(rssi),
            active,
            health,
            lastUpdated: g.lastUpdated,
          };
        });

        // 최신 활동 우선 정렬
        list.sort((a, b) => (b.msgPerSec - a.msgPerSec) || (b.lastUpdated - a.lastUpdated));

        if (!mounted) return;
        setItems(list);

        // 지도/상태판으로도 간단 전달(필요할 때)
        if (onStatusUpdate) {
          for (const it of list) {
            onStatusUpdate(it.l2id, { meta: { ipv4: it.ipv4 }, lastMsgTs: it.lastUpdated });
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("❌ load counts/devices failed:", e);
        }
      }
    };

    // 최초 즉시 + 1s 간격
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onStatusUpdate]);

  return (
    <div
      className={[
        "p-3 transition-colors overflow-hidden h-full min-h-0",
        className,
      ].join(" ")}
    >
      {items.length === 0 ? (
        <div className="h-24 grid place-items-center text-slate-400">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
            </svg>
            <span>Searching for stations…</span>
          </div>
        </div>
      ) : (
        <div className="h-full overflow-y-auto pr-1 space-y-2">
          {items.map((it) => {
            const active = selectedId === it.l2id;
            return (
              <button
                key={it.l2id}
                type="button"
                onClick={() => onSelect?.(it)}
                className={[
                  "w-full flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5 text-left",
                  "ring-1 ring-white/10 transition-colors",
                  active ? "bg-slate-700/40" : "bg-[#0f172a]",
                ].join(" ")}
                aria-pressed={active}
                aria-label={`Station ${it.serial}`}
              >
                {/* 좌측: LED + 시리얼/IP */}
                <div className="flex items-center gap-3 min-w-0">
                  <Led on={it.active} />
                  <div className="truncate">
                    <div className="font-semibold tracking-tight truncate">{it.serial}</div>
                  </div>
                </div>

                {/* 중앙: H/W health (도넛 숫자) */}
                <div className="flex items-center gap-2">
                  <Donut value={it.health} color={healthColorForPct(it.health)} size={24} stroke={6} variant="conic" />
                  <span className="text-slate-300 text-sm w-14 text-right">{it.health}%</span>
                </div>

                {/* 우측: 신호 막대 + 초당 메시지 */}
                <div className="flex items-end gap-3 shrink-0">
                  <SignalBars bars={it.bars} />
                  <div className="text-xs text-slate-300 whitespace-nowrap">
                    {it.msgPerSec} dBm
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function estimateHealth({ rssi, recent }) {
  // 간단 가중치: 신호 좋고 최근 활동 있으면 높음
  const rssiScore = rssi == null ? 50 : Math.max(0, Math.min(100, (rssi + 100) * 2));
  const recentScore = Math.min(100, recent * 20);
  return Math.max(0, Math.min(100, Math.round(0.7 * rssiScore + 0.3 * recentScore)));
}
