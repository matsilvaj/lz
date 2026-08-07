import { MonitorMaintenanceState } from "../_components/monitor-maintenance-state";
import { MonitorShell } from "../_components/monitor-shell";

export default function MonitorConverterFreebetPage() {
  return (
    <MonitorShell activeTab="converter-freebet">
      <MonitorMaintenanceState />
    </MonitorShell>
  );
}
