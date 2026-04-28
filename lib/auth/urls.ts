import "server-only";

import { headers } from "next/headers";

export async function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    const normalizedUrl = configuredUrl.replace(/\/$/, "");

    if (process.env.NODE_ENV === "production") {
      try {
        if (new URL(normalizedUrl).protocol !== "https:") {
          throw new Error();
        }
      } catch {
        throw new Error('Defina "NEXT_PUBLIC_APP_URL" com uma URL HTTPS valida.');
      }
    }

    return normalizedUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error('Defina "NEXT_PUBLIC_APP_URL" com o dominio publico HTTPS em producao.');
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}
