import { MonitorShell } from "../_components/monitor-shell";
import { DoubleMonitorWorkspace } from "../duplo/double-monitor-workspace";

export const dynamic = "force-dynamic";

export default function MonitorSemanalBet365Page() {
  return (
    <MonitorShell activeTab="semanal-bet365">
      <DoubleMonitorWorkspace variant="semanal-bet365" />
    </MonitorShell>
  );
}
