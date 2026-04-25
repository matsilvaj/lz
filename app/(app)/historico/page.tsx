import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

export default async function HistoryPage() {
  const data = await getHistoryPageData();

  return (
    <HistoryWorkspace
      months={data.months}
      operations={data.operations}
    />
  );
}
