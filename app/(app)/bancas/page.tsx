import { requireBaseContext } from "@/lib/auth/base-context";
import { getBookmakersPageData } from "@/lib/server/app-data";

import { BookmakersWorkspace } from "./bookmakers-workspace";

export default async function BookmakersPage() {
  const { activeBase, user } = await requireBaseContext();
  const data = await getBookmakersPageData(user.id, activeBase.id);

  return (
    <BookmakersWorkspace
      availableBookmakers={data.availableBookmakers}
      bookmakers={data.bookmakers}
      initialNotes={data.notes}
    />
  );
}
