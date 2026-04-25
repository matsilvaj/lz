import { getDashboardData } from "@/lib/server/app-data";

import { DashboardWorkspace } from "./dashboard-workspace";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return <DashboardWorkspace data={data} />;
}
