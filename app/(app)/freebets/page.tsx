import { requireBaseContext } from "@/lib/auth/base-context";
import { getFreebetsPageData } from "@/lib/server/app-data";

import { FreebetsWorkspace } from "./freebets-workspace";

export default async function FreebetsPage() {
  const { activeBase, user } = await requireBaseContext();
  const data = await getFreebetsPageData(user.id, activeBase.id);

  return (
    <FreebetsWorkspace
      convertibleGroups={data.convertibleGroups}
      convertedHistory={data.convertedHistory}
      pendingConfirmation={data.pendingConfirmation}
    />
  );
}
