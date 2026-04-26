export type ToastTone = "success" | "error" | "info";

export function appendToastParams(
  url: string,
  tone: ToastTone,
  title: string,
  description?: string,
) {
  const [pathWithQuery, hash = ""] = url.split("#");
  const [pathname, query = ""] = pathWithQuery.split("?");
  const searchParams = new URLSearchParams(query);

  searchParams.set("toast", title);
  searchParams.set("toastType", tone);

  if (description) {
    searchParams.set("toastDescription", description);
  } else {
    searchParams.delete("toastDescription");
  }

  const nextQuery = searchParams.toString();
  const nextHash = hash ? `#${hash}` : "";

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${nextHash}`;
}
