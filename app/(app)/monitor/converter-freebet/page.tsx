import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getFreebetsPageData } from "@/lib/server/app-data";

import { MonitorShell } from "../_components/monitor-shell";
import { FreebetConverterMonitorWorkspace } from "./freebet-converter-monitor-workspace";

export const dynamic = "force-dynamic";

export default async function MonitorConverterFreebetPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getFreebetsPageData(user.id, activeWorkspace.id);

  return (
    <MonitorShell activeTab="converter-freebet">
      <FreebetConverterMonitorWorkspace
        bookmakers={data.bookmakers}
        convertibleGroups={data.convertibleGroups}
      />
    </MonitorShell>
  );
}
