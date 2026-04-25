import { requireBaseContext } from "@/lib/auth/base-context";
import { getDashboardData } from "@/lib/server/app-data";

import { DashboardWorkspace } from "./dashboard-workspace";

export default async function DashboardPage() {
  const { activeBase, user } = await requireBaseContext();
  const data = await getDashboardData(user.id, activeBase.id);

  return <DashboardWorkspace data={data} />;
}
