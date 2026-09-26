import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getHistoryPageData } from "@/lib/server/app-data";

import { HistoryWorkspace } from "./history-workspace";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getSearchParamValues(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export default async function HistoryPage({
  searchParams,
}: HistoryPageProps) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const params = await searchParams;
  // "month" continua aceito para não quebrar links antigos.
  const period =
    getSearchParamValue(params.period) ||
    (getSearchParamValue(params.month) ? `month:${getSearchParamValue(params.month)}` : "");
  const data = await getHistoryPageData(
    user.id,
    activeWorkspace.id,
    period,
    getSearchParamValues(params.partner),
    getSearchParamValues(params.type),
    getSearchParamValues(params.house),
    getSearchParamValues(params.status),
    getSearchParamValues(params.multiple),
    getSearchParamValue(params.favorites) === "1",
  );

  return (
    <HistoryWorkspace
      activePeriod={data.activePeriod}
      bookmakers={data.bookmakers}
      operations={data.operations}
      partners={data.partners}
      periodOptions={data.periodOptions}
      onlyFavorites={data.onlyFavorites}
      selectedHouses={data.selectedHouses}
      selectedMultiples={data.selectedMultiples}
      selectedPartners={data.selectedPartners}
      selectedPeriodId={data.selectedPeriodId}
      selectedStatuses={data.selectedStatuses}
      selectedTypes={data.selectedTypes}
    />
  );
}
