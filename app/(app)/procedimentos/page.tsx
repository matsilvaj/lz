import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProceduresPageData } from "@/lib/server/app-data";

import { ProceduresWorkspace } from "./procedures-workspace";

export default async function ProceduresPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getProceduresPageData(user.id, activeWorkspace.id);

  return (
    <ProceduresWorkspace
      bookmakers={data.bookmakers}
      procedures={data.procedures}
    />
  );
}
