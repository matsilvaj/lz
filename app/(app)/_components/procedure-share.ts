import { type ProcedureShareValues } from "./procedure-share-types";

export const PROCEDURE_SHARE_PARAM = "procedureShare";

export function encodeProcedureSharePayload(payload: ProcedureShareValues) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeProcedureSharePayload(
  value: string,
): ProcedureShareValues | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    return decoded && typeof decoded === "object"
      ? (decoded as ProcedureShareValues)
      : null;
  } catch {
    return null;
  }
}

export function buildProcedureShareUrl(payload: ProcedureShareValues) {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL("/procedimentos", window.location.origin);
  url.searchParams.set(PROCEDURE_SHARE_PARAM, encodeProcedureSharePayload(payload));

  return url.toString();
}
