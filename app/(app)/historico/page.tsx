import { requireBaseContext } from "@/lib/auth/base-context";
import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

export default async function HistoryPage() {
  const { activeBase, user } = await requireBaseContext();
  const data = await getHistoryPageData(user.id, activeBase.id);

  return (
    <HistoryWorkspace
      months={data.months}
      operations={data.operations}
    />
  );
}
