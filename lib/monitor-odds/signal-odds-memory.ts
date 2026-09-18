// Memória de odds das telas de sinais (Duplo, Semanal e Converter): mostra as odds
// já vistas enquanto a próxima atualização chega.

import type { DuploEvent, DuploOddItem } from "./duplo";

export type SignalOddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: DuploOddItem[];
};

export function cloneSignalEvent(event: DuploEvent): DuploEvent {
  return {
    ...event,
    odds: event.odds.map((odd) => ({ ...odd })),
  };
}

// Troca as odds de cada jogo pelas do snapshot, mantendo os dados do jogo.
export function mergeSignalOddsSnapshots(
  events: DuploEvent[],
  snapshots: SignalOddsSnapshot[],
) {
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return events.map((event) => {
    const snapshot = snapshotsByFixtureId.get(event.fixture_id);

    if (!snapshot?.odds?.length) {
      return event;
    }

    const odds = snapshot.odds.map((odd) => ({
      ...odd,
      away_team: event.away_team,
      fixture_id: event.fixture_id,
      fixture_name: event.fixture_name,
      home_team: event.home_team,
      league_country: event.league_country,
      league_name: event.league_name,
      starts_at: event.starts_at,
    }));

    return {
      ...event,
      latest_odd_updated_at: snapshot.latest_odd_updated_at,
      odds,
    };
  });
}

// Guarda os últimos snapshots por jogo, descartando os mais antigos além do limite.
export class SignalOddsMemory {
  private readonly snapshots = new Map<string, SignalOddsSnapshot>();

  constructor(private readonly limit = 300) {}

  remember(snapshots: SignalOddsSnapshot[]) {
    for (const snapshot of snapshots) {
      if (!snapshot.fixture_id || !snapshot.odds.length) {
        continue;
      }

      this.snapshots.delete(snapshot.fixture_id);
      this.snapshots.set(snapshot.fixture_id, {
        ...snapshot,
        odds: snapshot.odds.map((odd) => ({ ...odd })),
      });
    }

    while (this.snapshots.size > this.limit) {
      const oldestFixtureId = this.snapshots.keys().next().value;

      if (!oldestFixtureId) {
        return;
      }

      this.snapshots.delete(oldestFixtureId);
    }
  }

  rememberEvents(events: DuploEvent[]) {
    this.remember(
      events
        .filter((event) => event.odds.length)
        .map((event) => ({
          fixture_id: event.fixture_id,
          latest_odd_updated_at: null,
          odds: event.odds,
        })),
    );
  }

  hydrate(events: DuploEvent[]) {
    const snapshots = events
      .map((event) => this.snapshots.get(event.fixture_id))
      .filter((snapshot): snapshot is SignalOddsSnapshot => Boolean(snapshot));

    return snapshots.length ? mergeSignalOddsSnapshots(events, snapshots) : events;
  }
}
