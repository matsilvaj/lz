import { getProceduresPageData } from "@/lib/server/app-data";

import { ProceduresWorkspace } from "./procedures-workspace";

export default async function ProceduresPage() {
  const data = await getProceduresPageData();

  return (
    <ProceduresWorkspace
      bookmakers={data.bookmakers}
      procedures={data.procedures}
    />
  );
}
