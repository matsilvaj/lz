import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { listAvailableFreebetConsultationBookmakers } from "@/lib/monitor-odds/odds-data";
import { getFreebetsPageData } from "@/lib/server/app-data";

import { MonitorShell } from "../_components/monitor-shell";
import { FreebetConverterMonitorWorkspace } from "./freebet-converter-monitor-workspace";

export const dynamic = "force-dynamic";

export default async function MonitorConverterFreebetPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const [data, consultationBookmakers] = await Promise.all([
    getFreebetsPageData(user.id, activeWorkspace.id),
    listAvailableFreebetConsultationBookmakers(),
  ]);

  return (
    <MonitorShell activeTab="converter-freebet">
      <FreebetConverterMonitorWorkspace
        consultationBookmakers={consultationBookmakers}
        convertibleGroups={data.convertibleGroups}
      />
    </MonitorShell>
  );
}
