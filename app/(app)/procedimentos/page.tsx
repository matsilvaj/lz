import { requireBaseContext } from "@/lib/auth/base-context";
import { getProceduresPageData } from "@/lib/server/app-data";

import { ProceduresWorkspace } from "./procedures-workspace";

export default async function ProceduresPage() {
  const { activeBase, user } = await requireBaseContext();
  const data = await getProceduresPageData(user.id, activeBase.id);

  return (
    <ProceduresWorkspace
      bookmakers={data.bookmakers}
      procedures={data.procedures}
    />
  );
}
