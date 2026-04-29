import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProceduresPageData } from "@/lib/server/app-data";

import { ProceduresWorkspace } from "./procedures-workspace";

type ProceduresPageProps = {
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

export default async function ProceduresPage({
  searchParams,
}: ProceduresPageProps) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const params = await searchParams;
  const filters = {
    searchText: getSearchParamValue(params.q),
    types: getSearchParamValues(params.type),
    houses: getSearchParamValues(params.house),
    dateFrom: getSearchParamValue(params.from),
    dateTo: getSearchParamValue(params.to),
    page: Number(getSearchParamValue(params.page)),
    pageSize: Number(getSearchParamValue(params.pageSize)),
  };
  const data = await getProceduresPageData(user.id, activeWorkspace.id, filters);

  return (
    <ProceduresWorkspace
      bookmakers={data.bookmakers}
      filters={{
        searchText: filters.searchText,
        types: filters.types,
        houses: filters.houses,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }}
      pagination={data.pagination}
      procedures={data.procedures}
    />
  );
}
