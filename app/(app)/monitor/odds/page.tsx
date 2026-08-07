import { MonitorMaintenanceState } from "../_components/monitor-maintenance-state";
import { MonitorShell } from "../_components/monitor-shell";

export default function MonitorOddsPage() {
  return (
    <MonitorShell activeTab="odds">
      <MonitorMaintenanceState />
    </MonitorShell>
  );
}
