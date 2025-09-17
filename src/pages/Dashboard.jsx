import StatCard from "../components/StatCard";

export default function Dashboard() {
  return (
    <>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Offline Devices" value="5 / 112" />
        <StatCard title="Inbound Errors" value="2" />
        <StatCard title="Active Road Events" value="5" />
      </div>
    </>
  );
}
