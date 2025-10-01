// src/components/RecentV2XCardList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { countDb } from "../dbms/v2x_count_db";
import { deviceDb } from "../dbms/device_db";

export default function RecentV2XCardList({
  onStatusUpdate,        // 지도/상태 반영 (기존)
  onSelect,              // 상단 패널에 반영
  selectedId,            // 현재 선택된 l2id
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

  // Empty state
  if (items.length === 0) {
    return (
      <div className="mt-6 h-32 grid place-items-center text-slate-400">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
          </svg>
          <span>Searching for stations…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 mt-4 space-y-3">
      {items.map((it) => {
        const active = selectedId === it.l2id;
        return (
          <button
            key={it.l2id}
            type="button"
            onClick={() => onSelect?.(it)}
            className={[
              "w-full flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left",
              "ring-1 ring-white/10 transition-colors",
              active ? "bg-slate-700/40" : "bg-[#0f172a] hover:bg-slate-700/20",
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
              <HealthDonut pct={it.health} />
              <span className="text-slate-300 text-sm w-14 text-right">{it.health}%</span>
            </div>

            {/* 우측: 신호 막대 + 초당 메시지 */}
            <div className="flex items-end gap-3">
              <SignalBars bars={it.bars} />
              <div className="text-xs text-slate-300 whitespace-nowrap">
                {it.msgPerSec} dBm
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ========= UI bits ========= */
function Led({ on }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ${
        on
          ? "bg-emerald-500 ring-emerald-400/40 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
          : "bg-slate-500 ring-slate-300/30"
      }`}
      aria-label={on ? "활성" : "비활성"}
    />
  );
}
function HealthDonut({ pct = 70, size = 18, bg = "#1f2a3b", ok = "#22c55e", warn = "#f59e0b", bad = "#ef4444" }) {
  const color = pct >= 75 ? ok : pct >= 50 ? warn : bad;
  return (
    <span
      className="relative inline-block rotate-180"
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: `conic-gradient(${color} ${pct}%, ${bg} 0)`,
      }}
      aria-label={`HW 상태 ${pct}%`}
      title={`HW 상태 ${pct}%`}
    >
      <span
        className="absolute inset-[3px] rounded-full"
        style={{ background: "#0f172a" }}
      />
    </span>
  );
}
function SignalBars({ bars = 1 }) {
  return (
    <div className="flex items-end gap-1" aria-label={`신호 ${bars}/4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm ${i < bars ? "bg-[#28B555]" : "bg-slate-600"}`}
          style={{ height: `${8 + i * 6}px` }}
        />
      ))}
    </div>
  );
}

/* ========= Utils ========= */
function rssiToBars(rssi) {
  if (rssi == null) return 1;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}
function estimateHealth({ rssi, recent }) {
  // 간단 가중치: 신호 좋고 최근 활동 있으면 높음
  const rssiScore = rssi == null ? 50 : Math.max(0, Math.min(100, (rssi + 100) * 2));
  const recentScore = Math.min(100, recent * 20);
  return Math.max(0, Math.min(100, Math.round(0.7 * rssiScore + 0.3 * recentScore)));
}
