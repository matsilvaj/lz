import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function HistoryPage({
  searchParams,
}: HistoryPageProps) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const params = await searchParams;
  const data = await getHistoryPageData(
    user.id,
    activeWorkspace.id,
    getSearchParamValue(params.month),
  );

  return (
    <HistoryWorkspace
      months={data.months}
      operations={data.operations}
      selectedMonth={data.selectedMonth}
    />
  );
}
