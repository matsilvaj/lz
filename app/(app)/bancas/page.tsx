import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getBookmakersPageData } from "@/lib/server/app-data";

import { BookmakersWorkspace } from "./bookmakers-workspace";

export default async function BookmakersPage() {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const data = await getBookmakersPageData(user.id, activeWorkspace.id);

  return (
    <BookmakersWorkspace
      availableBookmakers={data.availableBookmakers}
      bookmakers={data.bookmakers}
      initialNotes={data.notes}
    />
  );
}
