"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteFilterPresetAction,
  getFilterPresetAction,
  saveFilterPresetAction,
} from "../filter-preset-actions";

type FilterState = Record<string, unknown>;

// Sessão: mantém os filtros enquanto a aba estiver aberta.
// Conta: filtro padrão do usuário, aplicado quando a aba ainda não tem filtros.
export function useScreenFilters<T extends FilterState>({
  apply,
  screen,
  state,
}: {
  apply: (filters: Partial<T>) => void;
  screen: string;
  state: T;
}) {
  const storageKey = `lz:filters:${screen}`;
  const readyRef = useRef(false);
  const [hasPreset, setHasPreset] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      let restored = false;

      try {
        const raw = window.sessionStorage.getItem(storageKey);
        const stored = raw ? (JSON.parse(raw) as Partial<T>) : null;

        if (stored && typeof stored === "object") {
          apply(stored);
          restored = true;
        }
      } catch {
        // Sem armazenamento da sessão: segue para o filtro padrão.
      }

      try {
        const preset = (await getFilterPresetAction(screen)) as Partial<T> | null;

        if (cancelled) {
          return;
        }

        setHasPreset(Boolean(preset));

        if (preset && !restored) {
          apply(preset);
        }
      } catch {
        // Sem filtro padrão salvo ou falha na consulta: mantém o estado atual.
      }

      if (!cancelled) {
        readyRef.current = true;
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Restaura apenas ao montar a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (!readyRef.current) {
      return;
    }

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Armazenamento indisponível: os filtros valem só nesta navegação.
    }
  }, [state, storageKey]);

  const savePreset = useCallback(async () => {
    setSavingPreset(true);

    try {
      await saveFilterPresetAction(screen, state);
      setHasPreset(true);
      return true;
    } catch {
      return false;
    } finally {
      setSavingPreset(false);
    }
  }, [screen, state]);

  const clearPreset = useCallback(async () => {
    setSavingPreset(true);

    try {
      await deleteFilterPresetAction(screen);
      setHasPreset(false);
      return true;
    } catch {
      return false;
    } finally {
      setSavingPreset(false);
    }
  }, [screen]);

  return { clearPreset, hasPreset, savePreset, savingPreset };
}
