import { MonitorShell } from "../_components/monitor-shell";
import { DoubleMonitorWorkspace } from "./double-monitor-workspace";

export const dynamic = "force-dynamic";

export default function MonitorDuploPage() {
  return (
    <MonitorShell activeTab="duplo">
      <DoubleMonitorWorkspace />
    </MonitorShell>
  );
}
