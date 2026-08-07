import { MonitorMaintenanceState } from "../_components/monitor-maintenance-state";
import { MonitorShell } from "../_components/monitor-shell";

export default function MonitorDuploPage() {
  return (
    <MonitorShell activeTab="duplo">
      <MonitorMaintenanceState />
    </MonitorShell>
  );
}
