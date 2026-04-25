import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getFreebetsPageData } from "@/lib/server/app-data";

import { FreebetsWorkspace } from "./freebets-workspace";

export default async function FreebetsPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getFreebetsPageData(user.id, activeWorkspace.id);

  return (
    <FreebetsWorkspace
      convertibleGroups={data.convertibleGroups}
      convertedHistory={data.convertedHistory}
      pendingConfirmation={data.pendingConfirmation}
    />
  );
}
