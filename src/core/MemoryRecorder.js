// src/core/MemoryRecorder.js
import { packetToCsvRow, CSV_HEADER } from "../adapters/packetToCsvRow";

export class MemoryRecorder {
  constructor({ includeRawJson = true, maxRows = 100_000 } = {}) {
    this.includeRawJson = includeRawJson;
    this.maxRows = maxRows;
    this.rows = []; // array of raw packet objects or csv-rows? we store raw packet + recvAt to allow conversion later
    this.startedAt = null;
    this.endedAt = null;
  }

  start() {
    this.rows = [];
    this.startedAt = Date.now();
    this.endedAt = null;
  }

  add(packetObj, recvAtMs = Date.now()) {
    if (!this.startedAt) return;
    if (!packetObj) return;
    // enforce bounded size
    if (this.rows.length >= this.maxRows) {
      this.rows.shift(); // drop oldest
    }
    // store minimal: { pkt, recvAt }
    this.rows.push({ pkt: packetObj, recvAt: recvAtMs });
  }

  stop() {
    this.endedAt = Date.now();
  }

  header() {
    return [...CSV_HEADER.filter(h => this.includeRawJson || h !== "raw_json")];
  }

  // produce CSV rows (objects with header keys)
  getRows() {
    return this.rows.map(({ pkt, recvAt }) => {
      return packetToCsvRow(pkt, recvAt, { includeRawJson: this.includeRawJson });
    });
  }

  // grouped by serial -> Map(serial -> rows[])
  getRowsGroupedBySerial() {
    const map = new Map();
    for (const row of this.getRows()) {
      const k = row.serial || "unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    }
    return map;
  }
}

// singleton (easy import)
export const memoryRecorder = new MemoryRecorder({ includeRawJson: true, maxRows: 100_000 });
