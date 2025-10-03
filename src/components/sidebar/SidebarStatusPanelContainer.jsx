// src/components/sidebar/SidebarStatusPanelContainer.jsx
import SidebarStatusPanel from "./SidebarStatusPanel";
import { useVmStatusStore } from "../../stores/VmStatusStore";

export default function SidebarStatusPanelContainer({ isCollapsed = false, className = "" }) {
  const parsed = useVmStatusStore((s) => s.parsed);

  return (
    <SidebarStatusPanel
      isCollapsed={isCollapsed}
      fmsStatus={!parsed.fmsStatus}
      v2xReady={parsed.v2xReady}
      freqMHz={parsed.freqMHz}
      bwMHz={parsed.bwMHz}
      txCount={parsed.txCount}
      rxCount={parsed.rxCount}
      gnss={parsed.gnss}
      className={className}
    />
  );
}
