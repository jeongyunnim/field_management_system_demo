export default function StatCard({ title, value }) {
  return (
    <div className="bg-gray-700 p-4 rounded shadow hover:shadow-lg transition">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-2xl font-bold text-green-400">{value}</p>
    </div>
  );
}
