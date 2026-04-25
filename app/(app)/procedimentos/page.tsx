import { requireUser } from "@/lib/auth/session";
import { getProceduresPageData } from "@/lib/server/app-data";

import { ProceduresWorkspace } from "./procedures-workspace";

export default async function ProceduresPage() {
  const user = await requireUser();
  const data = await getProceduresPageData(user.id);

  return (
    <ProceduresWorkspace
      bookmakers={data.bookmakers}
      procedures={data.procedures}
    />
  );
}
