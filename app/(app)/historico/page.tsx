import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

export default async function HistoryPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getHistoryPageData(user.id, activeWorkspace.id);

  return (
    <HistoryWorkspace
      months={data.months}
      operations={data.operations}
    />
  );
}
