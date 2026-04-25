import { getFreebetsPageData } from "@/lib/server/app-data";

import { FreebetsWorkspace } from "./freebets-workspace";

export default async function FreebetsPage() {
  const data = await getFreebetsPageData();

  return (
    <FreebetsWorkspace
      convertibleGroups={data.convertibleGroups}
      convertedHistory={data.convertedHistory}
      pendingConfirmation={data.pendingConfirmation}
    />
  );
}
