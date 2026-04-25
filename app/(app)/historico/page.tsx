import { requireUser } from "@/lib/auth/session";
import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

export default async function HistoryPage() {
  const user = await requireUser();
  const data = await getHistoryPageData(user.id);

  return (
    <HistoryWorkspace
      months={data.months}
      operations={data.operations}
    />
  );
}
