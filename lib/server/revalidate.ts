import "server-only";

import { revalidatePath, updateTag } from "next/cache";

const APP_DATA_PATHS = [
  "/dashboard",
  "/procedimentos",
  "/freebets",
  "/calculadora",
  "/bancas",
  "/historico",
];
const APP_DATA_TAGS = [
  "dashboard-data",
  "freebets-page-data",
  "bookmakers-page-data",
  "history-page-data",
];

// Invalida as telas e os caches que mostram dados de procedimentos e bancas.
export function revalidateAppData(extraPaths: string[] = []) {
  for (const path of [...APP_DATA_PATHS, ...extraPaths]) {
    revalidatePath(path);
  }

  for (const tag of APP_DATA_TAGS) {
    updateTag(tag);
  }
}
