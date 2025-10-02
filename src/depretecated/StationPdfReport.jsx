// components/StationPdfReport.jsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 12 },
  title: { fontSize: 16, marginBottom: 10, fontWeight: "bold" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 100, fontWeight: "bold" },
  value: { flex: 1 }
});

const tableStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#000"
  },
  cell: {
    flex: 1,
    padding: 4,
    borderLeftWidth: 1,
    borderColor: "#000",
    fontSize: 10
  },
  cellHeader: {
    flex: 1,
    padding: 4,
    fontWeight: "bold",
    borderLeftWidth: 1,
    borderColor: "#000",
    fontSize: 10
  }
});

export default function StationPdfReport({ data }) {
  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Station Report - {data.l2idSrc}</Text>
        {/* Basic Info */}
        <View style={styles.row}>
          <Text style={styles.label}>L2ID:</Text>
          <Text style={styles.value}>{data.l2idSrc}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>IPv4:</Text>
          <Text style={styles.value}>{data.ipv4 || "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Registered:</Text>
          <Text style={styles.value}>{data.isRegistered ? "Yes" : "No"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Msgs/sec:</Text>
          <Text style={styles.value}>{data.msgPerSec}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>RSSI:</Text>
          <Text style={styles.value}>{data.lastRssi ?? "N/A"}</Text>
        </View>
        {/* PSID Counts */}
        <Text style={{ marginTop: 10, fontWeight: "bold" }}>PSID Counts</Text>
        {Object.entries(data.psidCount).map(([psid, count]) => (
          <Text key={psid}>
            • PSID {psid}: {count}
          </Text>
        ))}
        {/* System Status */}
        {data.systemStatus && (
          <>
            <Text style={{ marginTop: 10, fontWeight: "bold" }}>
              System Status
            </Text>
            <Text>
              CPU:{" "}
              {data.systemStatus.cpu_usage_status?.cpu_usage_total_percent ??
                "-"}
              %
            </Text>
            <Text>
              RAM:{" "}
              {data.systemStatus.memory_usage_status?.memory_usage_percent ??
                "-"}
              %
            </Text>
            <Text>
              eMMC:{" "}
              {data.systemStatus.storage_usage_status?.storage_usage_percent ??
                "-"}
              %
            </Text>
            <Text>
              Temperature:{" "}
              {data.systemStatus.temperature_status?.temperature_celsius?.toFixed(
                1
              ) ?? "-"}
              °C
            </Text>
            <Text>
              GNSS:{" "}
              {(() => {
                switch (data.systemStatus.gnss_data?.mode) {
                  case 1:
                    return "No Fix";
                  case 2:
                    return "2D Fix";
                  case 3:
                    return "3D Fix";
                  default:
                    return "N/A";
                }
              })()}{" "}
              ({data.systemStatus.gnss_data?.numUsedSatellites ?? "-"}{" "}
              satellites)
            </Text>

            {/* Hardware Status Table */}
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
                Hardware Status
              </Text>
              <View style={{ borderWidth: 1, borderColor: "#000" }}>
                <View style={{ flexDirection: "row", backgroundColor: "#eee" }}>
                  <Text style={tableStyles.cellHeader}>Item</Text>
                  <Text style={tableStyles.cellHeader}>Status</Text>
                </View>
                {[
                  { key: "gnss_antenna_status", label: "GNSS" },
                  { key: "ltev2x_antenna1_status", label: "V2X Antenna 1" },
                  { key: "ltev2x_antenna2_status", label: "V2X Antenna 2" },
                  {
                    key: "temperature_status.temperature_status",
                    label: "Temperature Sensor"
                  },
                  { key: "v2x_usb_status", label: "V2X-USB" },
                  { key: "v2x_spi_status", label: "V2X-SPI" },
                  { key: "sram_vbat_status", label: "SRAM_VBAT" },
                  { key: "ltev2x_tx_ready_status", label: "LTEV2X TX Ready" }
                ].map((item) => {
                  const value = item.key
                    .split(".")
                    .reduce((acc, p) => acc?.[p], data.systemStatus);
                  const statusText = value === true ? "OK" : "FAIL";
                  return (
                    <View key={item.key} style={tableStyles.row}>
                      <Text style={tableStyles.cell}>{item.label}</Text>
                      <Text style={tableStyles.cell}>{statusText}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 6 }}>
            Sample Bar Charts
          </Text>

          <Text style={{ fontSize: 10 }}>CPU Usage: 75%</Text>
          <View
            style={{
              height: 8,
              width: "100%",
              backgroundColor: "#eee",
              marginBottom: 4
            }}
          >
            <View
              style={{
                width: "75%",
                height: "100%",
                backgroundColor: "#4ade80"
              }}
            />
          </View>

          <Text style={{ fontSize: 10 }}>RAM Usage: 42%</Text>
          <View
            style={{
              height: 8,
              width: "100%",
              backgroundColor: "#eee",
              marginBottom: 4
            }}
          >
            <View
              style={{
                width: "42%",
                height: "100%",
                backgroundColor: "#60a5fa"
              }}
            />
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
            eMMC Usage History
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 2,
              alignItems: "flex-end",
              height: 40
            }}
          >
            {[40, 60, 80, 30, 90, 50, 70].map((val, idx) => (
              <View
                key={idx}
                style={{
                  width: 6,
                  height: `${val * 0.4}px`,
                  backgroundColor: "#f59e0b"
                }}
              />
            ))}
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
            Health Indicators
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{ backgroundColor: "#10b981", width: 14, height: 14 }}
            />
            <Text style={{ fontSize: 10 }}>Good</Text>
            <View
              style={{ backgroundColor: "#facc15", width: 14, height: 14 }}
            />
            <Text style={{ fontSize: 10 }}>Warning</Text>
            <View
              style={{ backgroundColor: "#ef4444", width: 14, height: 14 }}
            />
            <Text style={{ fontSize: 10 }}>Critical</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
