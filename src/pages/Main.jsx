// pages/Main.jsx
import MainSystemStats from "../components/MainSystemStats";
import EventLogPanel from "../components/EventLogPanel";

export default function Main() {
  return (
    <div
      className="
        h-full
        grid
      "
    >
      <div className="grid gap-7 grid-cols-2">
        <MainSystemStats />
        <EventLogPanel />
      </div>
    </div>
  );
}
