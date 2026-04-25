import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/server/app-data";

import { DashboardWorkspace } from "./dashboard-workspace";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  return <DashboardWorkspace data={data} />;
}
