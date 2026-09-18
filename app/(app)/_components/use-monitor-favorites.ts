"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useToast } from "@/app/_components/toast-provider";

import {
  getMonitorFavoritesAction,
  setMonitorFavoriteAction,
  type MonitorFavoriteType,
} from "../monitor-favorite-actions";

type FavoritesSnapshot = {
  games: string[];
  leagues: string[];
};

// Estado único para todas as telas do monitor; outras abas do navegador são avisadas pelo canal.
const CHANNEL_NAME = "lz-monitor-favorites";
const emptySnapshot: FavoritesSnapshot = { games: [], leagues: [] };
let snapshot: FavoritesSnapshot = emptySnapshot;
let loadPromise: Promise<void> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: FavoritesSnapshot, broadcast = false) {
  snapshot = next;
  emit();

  if (broadcast) {
    channel?.postMessage(next);
  }
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") {
    return;
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<FavoritesSnapshot>) => {
    if (event.data && Array.isArray(event.data.games) && Array.isArray(event.data.leagues)) {
      setSnapshot(event.data);
    }
  };
}

function loadFavorites(force = false) {
  if (loadPromise && !force) {
    return loadPromise;
  }

  loadPromise = getMonitorFavoritesAction()
    .then((favorites) => setSnapshot(favorites))
    .catch(() => {
      loadPromise = null;
    });

  return loadPromise;
}

function subscribe(listener: () => void) {
  ensureChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMonitorFavorites() {
  const { showToast } = useToast();
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => emptySnapshot,
  );

  useEffect(() => {
    void loadFavorites(true);
  }, []);

  const toggle = useCallback(
    (type: MonitorFavoriteType, key: string) => {
      const listKey = type === "jogo" ? "games" : "leagues";
      const previous = snapshot;
      const favorite = !previous[listKey].includes(key);
      const nextList = favorite
        ? [...previous[listKey], key]
        : previous[listKey].filter((item) => item !== key);

      setSnapshot({ ...previous, [listKey]: nextList }, true);

      setMonitorFavoriteAction(type, key, favorite).catch(() => {
        setSnapshot(previous, true);
        showToast({ title: "Não foi possível atualizar o favorito.", tone: "error" });
      });
    },
    [showToast],
  );

  return {
    favoriteGames: useMemo(() => new Set(current.games), [current.games]),
    favoriteLeagues: useMemo(() => new Set(current.leagues), [current.leagues]),
    toggleGame: useCallback((fixtureId: string) => toggle("jogo", fixtureId), [toggle]),
    toggleLeague: useCallback((leagueKey: string) => toggle("campeonato", leagueKey), [toggle]),
  };
}
