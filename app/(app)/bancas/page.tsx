import { requireUser } from "@/lib/auth/session";
import { getBookmakersPageData } from "@/lib/server/app-data";

import { BookmakersWorkspace } from "./bookmakers-workspace";

export default async function BookmakersPage() {
  const user = await requireUser();
  const data = await getBookmakersPageData(user.id);

  return (
    <BookmakersWorkspace
      availableBookmakers={data.availableBookmakers}
      bookmakers={data.bookmakers}
      initialNotes={data.notes}
    />
  );
}
