export type SharedCalculatorLine = {
  aumento_percentual?: unknown;
  cashback_percentual?: unknown;
  comissao_percentual?: unknown;
  freebet?: unknown;
  house?: unknown;
  odd?: unknown;
  responsabilidade?: unknown;
  responsabilidadeEdited?: unknown;
  stake?: unknown;
  stakeEdited?: unknown;
  tipo?: unknown;
};

export type SharedCalculatorPayload = {
  configExpanded?: boolean;
  lineCount?: number;
  lines?: SharedCalculatorLine[];
  version?: number;
  workspaceIndex?: number;
};

export function encodeCalculatorPayload(payload: SharedCalculatorPayload) {
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

export function decodeCalculatorPayload(value: string): SharedCalculatorPayload | null {
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
      ? (decoded as SharedCalculatorPayload)
      : null;
  } catch {
    return null;
  }
}
