"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { getTrendingFixturesAction } from "../monitor-trending-actions";

// Ranking compartilhado entre as telas do monitor; atualizado a cada 5 minutos.
const REFRESH_INTERVAL_MS = 5 * 60_000;
const emptySnapshot: string[] = [];
let snapshot: string[] = emptySnapshot;
let lastLoadedAt = 0;
let loading = false;
const listeners = new Set<() => void>();

function loadTrending(force = false) {
  if (loading || (!force && Date.now() - lastLoadedAt < REFRESH_INTERVAL_MS)) {
    return;
  }

  loading = true;
  getTrendingFixturesAction()
    .then((fixtureIds) => {
      lastLoadedAt = Date.now();
      snapshot = Array.isArray(fixtureIds) ? fixtureIds : emptySnapshot;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch(() => undefined)
    .finally(() => {
      loading = false;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTrendingFixtures() {
  const fixtureIds = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => emptySnapshot,
  );

  useEffect(() => {
    loadTrending();
    const intervalId = window.setInterval(() => loadTrending(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  // Posição no ranking (0 = mais acessado).
  const trendingRank = useMemo(
    () => new Map(fixtureIds.map((fixtureId, index) => [fixtureId, index])),
    [fixtureIds],
  );

  return { trendingIds: fixtureIds, trendingRank };
}
