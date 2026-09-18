"use client";

// Hooks compartilhados pelas telas de sinais do monitor (Duplo, Semanal e Converter).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  mergeCalculatorSelections,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import type { DuploEvent } from "@/lib/monitor-odds/duplo";
import { fetchOddsSnapshots } from "@/lib/monitor-odds/odds-fetch";
import { areCalculatorSelectionsActive } from "@/lib/monitor-odds/signal-helpers";
import {
  mergeSignalOddsSnapshots,
  type SignalOddsMemory,
  type SignalOddsSnapshot,
} from "@/lib/monitor-odds/signal-odds-memory";
import {
  useMonitorOddsStatusFeed,
  type MonitorOddsStatus,
} from "@/lib/monitor-odds/use-status-feed";

// A consulta de status roda a cada 4s (barata), mas rebaixar as odds de todos
// os jogos custa ~200 KB, entao a lista se atualiza no maximo a cada 20s.
const ODDS_REFRESH_INTERVAL_MS = 20_000;

// Odds novas chegam sozinhas e a lista reordena junto: o intervalo de 20s e
// longo o bastante para isso nao atrapalhar o clique, e o melhor sinal
// aparecendo no topo e o que importa.
export function useSignalLiveOdds(
  events: DuploEvent[],
  memory: SignalOddsMemory,
  onEventsUpdate: (events: DuploEvent[]) => void,
) {
  const eventsRef = useRef<DuploEvent[]>([]);
  const oddsVersionRef = useRef<string | null>(null);
  const lastOddsRefreshAtRef = useRef(0);
  const onEventsUpdateRef = useRef(onEventsUpdate);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    onEventsUpdateRef.current = onEventsUpdate;
  }, [onEventsUpdate]);

  const handleStatusUpdate = useCallback(
    async (status: MonitorOddsStatus) => {
      const nextOddsVersion =
        status.odds_version ?? status.latest_odd_updated_at ?? null;

      if (!nextOddsVersion || nextOddsVersion === oddsVersionRef.current) {
        return;
      }

      if (Date.now() - lastOddsRefreshAtRef.current < ODDS_REFRESH_INTERVAL_MS) {
        return;
      }

      const currentEvents = eventsRef.current;

      if (!currentEvents.length) {
        return;
      }

      lastOddsRefreshAtRef.current = Date.now();

      try {
        const result = await fetchOddsSnapshots<SignalOddsSnapshot>(
          currentEvents.map((event) => event.fixture_id),
          nextOddsVersion,
        );

        if (!result?.complete) {
          return;
        }

        oddsVersionRef.current = result.oddsVersion;
        memory.remember(result.snapshots);
        onEventsUpdateRef.current(
          mergeSignalOddsSnapshots(currentEvents, result.snapshots),
        );
      } catch {
        // Atualizacao automatica e best-effort: o que esta na tela continua valido.
      }
    },
    [memory],
  );

  const canPollStatus = useCallback(() => eventsRef.current.length > 0, []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);
}

// Odds selecionadas para a calculadora: cada card entra ou sai por inteiro.
export function useCalculatorRowSelections<Row>(
  getSelections: (row: Row) => CalculatorSelectionLine[],
) {
  const [calculatorSelections, setCalculatorSelections] = useState<
    CalculatorSelectionLine[]
  >([]);
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );

  const toggleCalculatorRow = useCallback(
    (row: Row) => {
      const selections = getSelections(row);

      setCalculatorSelections((current) => {
        const currentIds = new Set(current.map((selection) => selection.id));
        const selected = areCalculatorSelectionsActive(currentIds, selections);

        return selected
          ? current.filter(
              (selection) => !selections.some((item) => item.id === selection.id),
            )
          : mergeCalculatorSelections(current, selections, { replaceAll: true });
      });
    },
    [getSelections],
  );

  const removeCalculatorSelection = useCallback((id: string) => {
    setCalculatorSelections((current) =>
      current.filter((selection) => selection.id !== id),
    );
  }, []);

  return {
    calculatorSelections,
    removeCalculatorSelection,
    selectedCalculatorIds,
    setCalculatorSelections,
    toggleCalculatorRow,
  };
}
