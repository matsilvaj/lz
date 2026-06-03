import { OddsEventSearch } from "../../odds/odds-event-search";
import { MonitorShell } from "../_components/monitor-shell";

export const dynamic = "force-dynamic";

export default function MonitorOddsPage() {
  return (
    <MonitorShell activeTab="odds">
      <OddsEventSearch eventBasePath="/monitor/odds" />
    </MonitorShell>
  );
}
