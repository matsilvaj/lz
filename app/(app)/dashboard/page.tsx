import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getDashboardData } from "@/lib/server/app-data";

import { DashboardWorkspace } from "./dashboard-workspace";

export default async function DashboardPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getDashboardData(user.id, activeWorkspace.id);

  return <DashboardWorkspace data={data} />;
}
