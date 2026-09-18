import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";

// Precisa acompanhar MAX_ODDS_FIXTURE_IDS em odds-data.ts. A constante nao e
// importada de la porque aquele modulo e "server-only" e este roda no browser.
export const oddsFixtureIdsPerRequest = 200;

export type OddsSnapshotsResult<TSnapshot> = {
  complete: boolean;
  oddsVersion: string | null;
  snapshots: TSnapshot[];
};

type OddsResponsePayload<TSnapshot> = {
  complete?: boolean;
  odds_version?: string | null;
  snapshots?: TSnapshot[];
};

function chunkFixtureIds(fixtureIds: string[]) {
  const chunks: string[][] = [];

  for (let index = 0; index < fixtureIds.length; index += oddsFixtureIdsPerRequest) {
    chunks.push(fixtureIds.slice(index, index + oddsFixtureIdsPerRequest));
  }

  return chunks;
}

// Busca os snapshots de odds em lotes. O endpoint descarta fixtureIds acima do
// limite por requisicao, entao pedir tudo de uma vez faria os jogos excedentes
// voltarem sem odds — e sem odds eles nunca geram sinal.
//
// Retorna null quando a sessao expirou (o redirect ja foi disparado), para o
// chamador poder interromper o carregamento.
export async function fetchOddsSnapshots<TSnapshot>(
  fixtureIds: string[],
  oddsVersion: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<OddsSnapshotsResult<TSnapshot> | null> {
  if (!fixtureIds.length) {
    return { complete: true, oddsVersion, snapshots: [] };
  }

  const snapshots: TSnapshot[] = [];
  let complete = true;
  let resolvedOddsVersion = oddsVersion;

  for (const chunk of chunkFixtureIds(fixtureIds)) {
    const response = await fetch("/api/monitor-odds/odds", {
      body: JSON.stringify({ fixtureIds: chunk, oddsVersion }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: options.signal,
    });

    if (redirectToLoginOnUnauthorized(response)) {
      return null;
    }

    if (response.status === 429) {
      throw new Error("Muitas atualizações em pouco tempo. Aguarde alguns segundos.");
    }

    if (!response.ok) {
      throw new Error("Não foi possível atualizar as odds dos jogos.");
    }

    const payload = (await response.json()) as OddsResponsePayload<TSnapshot>;

    if (payload.complete === false) {
      complete = false;
    }

    if (payload.odds_version) {
      resolvedOddsVersion = payload.odds_version;
    }

    for (const snapshot of payload.snapshots ?? []) {
      snapshots.push(snapshot);
    }
  }

  return { complete, oddsVersion: resolvedOddsVersion, snapshots };
}
