"use client";

import { useEffect, useRef } from "react";

import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";

export type MonitorOddsStatus = {
  fixtures_version?: string | null;
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

const statusChannelName = "lz-monitor-odds-status";
const statusLeaderKey = "lz-monitor-odds-status-leader";
const statusLeaderTtlMs = 12_000;
const statusPollIntervalMs = 4_000;

function getStatusLeader() {
  try {
    const raw = window.localStorage.getItem(statusLeaderKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; id?: unknown };

    if (typeof parsed.id !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }

    return {
      expiresAt: parsed.expiresAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function canLeadStatusPolling(tabId: string) {
  if (document.visibilityState === "hidden") {
    return false;
  }

  const now = Date.now();
  const leader = getStatusLeader();

  if (leader && leader.id !== tabId && leader.expiresAt > now) {
    return false;
  }

  try {
    window.localStorage.setItem(
      statusLeaderKey,
      JSON.stringify({ expiresAt: now + statusLeaderTtlMs, id: tabId }),
    );
  } catch {
    return true;
  }

  return true;
}

function releaseStatusLeader(tabId: string) {
  const leader = getStatusLeader();

  if (leader?.id !== tabId) {
    return;
  }

  try {
    window.localStorage.removeItem(statusLeaderKey);
  } catch {
    // Best-effort cleanup only.
  }
}

function createStatusTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Consulta periodica leve do estado do feed. Apenas uma aba consulta o
// servidor (eleicao por localStorage) e repassa o resultado para as outras via
// BroadcastChannel, entao abrir tres telas do monitor nao triplica o trafego.
//
// O hook so avisa que algo mudou; cada tela decide o que fazer com isso. A tela
// de detalhe rebaixa um jogo e pode reagir a cada aviso; as listas rebaixam
// todos os jogos e por isso limitam a propria frequencia.
export function useMonitorOddsStatusFeed(
  canPollStatus: () => boolean,
  onStatusUpdate: (payload: MonitorOddsStatus) => Promise<void> | void,
) {
  const statusChannelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>("");

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(statusChannelName);
    statusChannelRef.current = channel;

    function handleMessage(event: MessageEvent) {
      const data = event.data as {
        status?: MonitorOddsStatus;
        type?: string;
      };

      if (data?.type === "monitor-odds-status" && data.status) {
        void onStatusUpdate(data.status);
      }
    }

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      statusChannelRef.current = null;
    };
  }, [onStatusUpdate]);

  useEffect(() => {
    let active = true;
    tabIdRef.current = tabIdRef.current || createStatusTabId();

    async function checkFeedStatus() {
      if (
        !active ||
        !canPollStatus() ||
        !canLeadStatusPolling(tabIdRef.current)
      ) {
        return;
      }

      try {
        const response = await fetch("/api/monitor-odds/status", {
          cache: "no-store",
        });

        if (redirectToLoginOnUnauthorized(response)) {
          return;
        }

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as MonitorOddsStatus;

        if (!active) {
          return;
        }

        statusChannelRef.current?.postMessage({
          status: payload,
          type: "monitor-odds-status",
        });
        await onStatusUpdate(payload);
      } catch {
        // Status polling is only a freshness hint; the search remains usable.
      }
    }

    const timeoutId = window.setTimeout(checkFeedStatus, 750);
    const intervalId = window.setInterval(checkFeedStatus, statusPollIntervalMs);

    return () => {
      active = false;
      releaseStatusLeader(tabIdRef.current);
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [canPollStatus, onStatusUpdate]);
}

