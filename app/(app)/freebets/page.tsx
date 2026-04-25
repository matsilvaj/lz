import { requireUser } from "@/lib/auth/session";
import { getFreebetsPageData } from "@/lib/server/app-data";

import { FreebetsWorkspace } from "./freebets-workspace";

export default async function FreebetsPage() {
  const user = await requireUser();
  const data = await getFreebetsPageData(user.id);

  return (
    <FreebetsWorkspace
      convertibleGroups={data.convertibleGroups}
      convertedHistory={data.convertedHistory}
      pendingConfirmation={data.pendingConfirmation}
    />
  );
}
