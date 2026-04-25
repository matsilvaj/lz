import { getBookmakersPageData } from "@/lib/server/app-data";

import { BookmakersWorkspace } from "./bookmakers-workspace";

export default async function BookmakersPage() {
  const data = await getBookmakersPageData();

  return <BookmakersWorkspace bookmakers={data.bookmakers} />;
}
