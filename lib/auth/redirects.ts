import "server-only";

const LOCAL_ORIGIN = "https://lz.local";

const ALLOWED_APP_PATH_PREFIXES = [
  "/bancas",
  "/calculadora",
  "/dashboard",
  "/freebets",
  "/historico",
  "/login",
  "/monitor-de-duplos",
  "/odds",
  "/perfil",
  "/procedimentos",
  "/workspaces",
];

function isAllowedAppPath(pathname: string) {
  return ALLOWED_APP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getSafeAppPath(value: unknown, fallback = "/dashboard") {
  const path = typeof value === "string" ? value.trim() : "";

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(path)
  ) {
    return fallback;
  }

  try {
    const parsedUrl = new URL(path, LOCAL_ORIGIN);

    if (parsedUrl.origin !== LOCAL_ORIGIN || !isAllowedAppPath(parsedUrl.pathname)) {
      return fallback;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return fallback;
  }
}
