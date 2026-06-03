"use client";

import { calculateSurebet } from "@/core";
import { ArrowRight, Calculator, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  encodeCalculatorPayload,
  type SharedCalculatorPayload,
} from "@/lib/calculator-share";

export type CalculatorSelectionLine = {
  freebet?: boolean;
  house: string;
  id: string;
  meta?: string;
  odd: number;
  pa?: boolean;
  selectionKey: string;
  selectionLabel: string;
  stake?: number;
};

export type CalculatorConversionContext = {
  conversionBatchId?: string;
  entryValue: number;
  freebetValue: number;
  house: string;
  originIds: number[];
};

type CalculatorConversionSearchParams = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

export function createCalculatorSelectionId(
  parts: Array<number | string | null | undefined>,
) {
  return parts
    .map((part) =>
      String(part ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join(":");
}

export function mergeCalculatorSelections(
  current: CalculatorSelectionLine[],
  next: CalculatorSelectionLine[],
  options: { replaceAll?: boolean } = {},
) {
  if (!next.length) {
    return current;
  }

  if (options.replaceAll) {
    return next.slice(0, 3);
  }

  const byId = new Map(current.map((selection) => [selection.id, selection]));
  const bySelectionKey = new Map(
    current.map((selection) => [selection.selectionKey, selection.id]),
  );

  for (const selection of next) {
    const existingId = bySelectionKey.get(selection.selectionKey);

    if (existingId && existingId !== selection.id) {
      byId.delete(existingId);
      bySelectionKey.delete(selection.selectionKey);
    }

    if (!byId.has(selection.id)) {
      byId.set(selection.id, selection);
      bySelectionKey.set(selection.selectionKey, selection.id);
    } else {
      byId.set(selection.id, selection);
    }
  }

  return Array.from(byId.values()).slice(-3);
}

function formatCalculatorOdd(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0";
}

function formatCalculatorStake(value: number | undefined, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : fallback;
}

function getOrderedCalculatorSelections(selections: CalculatorSelectionLine[]) {
  const lines = selections.slice(0, 3);
  const freebetLine = lines.find((selection) => selection.freebet);

  if (!freebetLine) {
    return lines;
  }

  return [
    freebetLine,
    ...lines.filter((selection) => selection.id !== freebetLine.id),
  ];
}

function buildCalculatorPayload(selections: CalculatorSelectionLine[]): SharedCalculatorPayload {
  const lines = getOrderedCalculatorSelections(selections);
  const lineCount = Math.max(2, Math.min(lines.length, 3));

  return {
    configExpanded: false,
    lineCount,
    lines: lines.map((selection, index) => ({
      aumento_percentual: "0",
      cashback_percentual: "0",
      comissao_percentual: "0",
      freebet: Boolean(selection.freebet),
      house: selection.house,
      odd: formatCalculatorOdd(selection.odd),
      responsabilidade: "0",
      responsabilidadeEdited: false,
      stake: formatCalculatorStake(selection.stake, index === 0 ? "100" : "0"),
      stakeEdited: false,
      tipo: "B",
    })),
    version: 1,
    workspaceIndex: 0,
  };
}

function formatProfitPercent(value: number) {
  const safeValue = Math.abs(value) < 0.005 ? 0 : value;
  return `${safeValue.toFixed(2)}%`;
}

function getProfitClassName(value: number) {
  if (Math.abs(value) < 0.005) {
    return "text-white";
  }

  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function getDockProfitPercent(
  selections: CalculatorSelectionLine[],
  conversionContext: CalculatorConversionContext | null | undefined,
) {
  const lines = getOrderedCalculatorSelections(selections);

  if (lines.length < 2) {
    return null;
  }

  try {
    const calculation = calculateSurebet(
      lines.map((selection, index) => ({
        freebet: Boolean(selection.freebet),
        odd: selection.odd,
        stake:
          selection.stake ??
          (index === 0 ? conversionContext?.freebetValue ?? 100 : 0),
        tipo: "B",
      })),
      0,
    ) as { lucro_liquido?: number; lucro_percentual?: number };
    const profitAmount = Number(calculation.lucro_liquido ?? 0);
    const defaultProfitPercent = Number(calculation.lucro_percentual ?? 0);

    if (conversionContext?.freebetValue) {
      return (profitAmount / conversionContext.freebetValue) * 100;
    }

    return Number.isFinite(defaultProfitPercent) ? defaultProfitPercent : null;
  } catch {
    return null;
  }
}

export function appendConversionContextParams(
  params: URLSearchParams,
  conversionContext: CalculatorConversionContext | null | undefined,
) {
  if (!conversionContext) {
    return;
  }

  params.set("mode", "convert-freebet");
  params.set("house", conversionContext.house);
  params.set("freebetValue", String(conversionContext.freebetValue));
  params.set("entryValue", String(conversionContext.entryValue));

  if (conversionContext.conversionBatchId) {
    params.set("conversionBatchId", conversionContext.conversionBatchId);
  }

  for (const originId of conversionContext.originIds) {
    params.append("originIds", String(originId));
  }
}

export function parseConversionContextParams(
  params: CalculatorConversionSearchParams,
): CalculatorConversionContext | null {
  if (params.get("mode") !== "convert-freebet") {
    return null;
  }

  const house = params.get("house")?.trim() ?? "";
  const freebetValue = Number(params.get("freebetValue") ?? 0);
  const entryValue = Number(params.get("entryValue") ?? 0);
  const originIds = params
    .getAll("originIds")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!house || !Number.isFinite(freebetValue) || freebetValue <= 0) {
    return null;
  }

  return {
    conversionBatchId: params.get("conversionBatchId") ?? undefined,
    entryValue: Number.isFinite(entryValue) ? entryValue : 0,
    freebetValue,
    house,
    originIds,
  };
}

function getConversionSelectionHint(
  selections: CalculatorSelectionLine[],
  conversionContext: CalculatorConversionContext | null | undefined,
) {
  if (!conversionContext) {
    return null;
  }

  const selectedCount = selections.length;
  const hasFreebetSelection = selections.some((selection) => selection.freebet);

  if (selectedCount >= 3 && !hasFreebetSelection) {
    return `Troque uma seleção pela odd da casa ${conversionContext.house}.`;
  }

  if (selectedCount < 3 && hasFreebetSelection) {
    const remainingCount = 3 - selectedCount;

    return remainingCount === 1
      ? "Selecione mais 1 odd para completar a conversão."
      : `Selecione mais ${remainingCount} odds para completar a conversão.`;
  }

  if (selectedCount < 3) {
    const remainingCount = 3 - selectedCount;

    return remainingCount === 1
      ? `Selecione mais 1 odd, que precisa ser da casa ${conversionContext.house}.`
      : `Selecione mais ${remainingCount} odds, incluindo a casa ${conversionContext.house}.`;
  }

  return null;
}

export function CalculatorSelectionDock({
  conversionContext,
  onClear,
  onRemove,
  selections,
}: {
  conversionContext?: CalculatorConversionContext | null;
  onClear: () => void;
  onRemove: (id: string) => void;
  selections: CalculatorSelectionLine[];
}) {
  const [dockVisible, setDockVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [renderDock, setRenderDock] = useState(false);
  const [renderPanel, setRenderPanel] = useState(false);
  const [displaySelections, setDisplaySelections] = useState<
    CalculatorSelectionLine[]
  >([]);
  const closeTimeoutRef = useRef<number | null>(null);
  const dockTimeoutRef = useRef<number | null>(null);
  const hasSelections = selections.length > 0;
  const visibleSelections = hasSelections ? selections : displaySelections;
  const orderedVisibleSelections = useMemo(
    () => getOrderedCalculatorSelections(visibleSelections),
    [visibleSelections],
  );
  const hasFreebetSelection = orderedVisibleSelections.some(
    (selection) => selection.freebet,
  );
  const profitPercent = useMemo(
    () => getDockProfitPercent(orderedVisibleSelections, conversionContext),
    [conversionContext, orderedVisibleSelections],
  );
  const conversionSelectionReady =
    !conversionContext ||
    (orderedVisibleSelections.length === 3 && hasFreebetSelection);
  const conversionSelectionHint = getConversionSelectionHint(
    orderedVisibleSelections,
    conversionContext,
  );
  const canOpenCalculator =
    orderedVisibleSelections.length >= 2 && conversionSelectionReady;

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }

      if (dockTimeoutRef.current !== null) {
        window.clearTimeout(dockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (dockTimeoutRef.current !== null) {
      window.clearTimeout(dockTimeoutRef.current);
      dockTimeoutRef.current = null;
    }

    let enterAnimationFrame: number | null = null;
    const setupAnimationFrame = window.requestAnimationFrame(() => {
      if (!hasSelections) {
        setDockVisible(false);
        setExpanded(false);
        dockTimeoutRef.current = window.setTimeout(() => {
          setRenderPanel(false);
          setRenderDock(false);
          setDisplaySelections([]);
          dockTimeoutRef.current = null;
        }, 200);
        return;
      }

      setDisplaySelections(selections);
      setRenderDock(true);
      setRenderPanel(true);
      enterAnimationFrame = window.requestAnimationFrame(() => {
        setDockVisible(true);
        setExpanded(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(setupAnimationFrame);

      if (enterAnimationFrame !== null) {
        window.cancelAnimationFrame(enterAnimationFrame);
      }
    };
  }, [hasSelections, selections]);

  if (
    typeof document === "undefined" ||
    !renderDock ||
    !orderedVisibleSelections.length
  ) {
    return null;
  }

  function openCalculator() {
    if (!canOpenCalculator) {
      return;
    }

    const payload = buildCalculatorPayload(orderedVisibleSelections);
    const params = new URLSearchParams();
    appendConversionContextParams(params, conversionContext);
    params.set("calc", encodeCalculatorPayload(payload));
    const calculatorUrl = new URL("/calculadora", window.location.origin);
    calculatorUrl.search = params.toString();
    const calculatorWindow = window.open(calculatorUrl.toString(), "lz-calculadora");

    if (!calculatorWindow) {
      window.location.assign(calculatorUrl.toString());
      return;
    }

    calculatorWindow.focus();
  }

  function togglePanel() {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (expanded) {
      setExpanded(false);
      closeTimeoutRef.current = window.setTimeout(() => {
        setRenderPanel(false);
      }, 180);
      return;
    }

    setRenderPanel(true);
    window.requestAnimationFrame(() => {
      setExpanded(true);
    });
  }

  return createPortal(
    <div
      className={`fixed bottom-6 right-5 z-[160] flex max-w-[calc(100vw-2.5rem)] items-end gap-3 transition duration-200 ease-out md:right-8 ${
        dockVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-3 scale-[0.98] opacity-0"
      }`}
    >
      {renderPanel ? (
        <div
          className={`w-[min(18rem,calc(100vw-7rem))] origin-bottom-right rounded-[24px] border border-white/10 bg-[rgba(18,5,13,0.94)] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl transition duration-200 ease-out ${
            expanded
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3 scale-[0.97] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
              Calculadora
            </span>
            <button
              className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              onClick={onClear}
              type="button"
            >
              Limpar
            </button>
          </div>

          <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {orderedVisibleSelections.slice(0, 3).map((selection) => (
              <div
                className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2"
                key={selection.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-white">
                      {selection.house}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[rgb(191,219,254)]">
                      {formatCalculatorOdd(selection.odd)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                      {selection.meta
                        ? `${selection.selectionLabel} - ${selection.meta}`
                        : selection.selectionLabel}
                    </span>
                    {selection.pa ? (
                      <span className="shrink-0 rounded-full border border-[rgba(45,212,191,0.32)] bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        PA
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label={`Remover ${selection.house} ${selection.selectionLabel}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  onClick={() => onRemove(selection.id)}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {profitPercent !== null || conversionContext ? (
            <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.028] px-3 py-2">
              {profitPercent !== null ? (
                <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                  <span className="text-[var(--text-muted)]">Lucro %</span>
                  <span className={`tabular-nums ${getProfitClassName(profitPercent)}`}>
                    {formatProfitPercent(profitPercent)}
                  </span>
                </div>
              ) : null}
              {conversionSelectionHint ? (
                <p className="mt-1 text-[11px] font-medium leading-5 text-[var(--text-dim)]">
                  {conversionSelectionHint}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.96),rgba(147,8,58,0.96))] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-[var(--text-dim)] disabled:shadow-none disabled:hover:brightness-100"
            disabled={!canOpenCalculator}
            onClick={openCalculator}
            type="button"
          >
            <span>Ir para calculadora</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <button
        aria-expanded={expanded && renderPanel}
        aria-label={
          expanded && renderPanel
            ? "Ocultar odds selecionadas"
            : "Mostrar odds selecionadas"
        }
        className="relative inline-flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border border-[rgba(255,139,187,0.5)] bg-[linear-gradient(180deg,rgba(211,27,91,0.98),rgba(147,8,58,0.98))] text-white shadow-[0_18px_50px_rgba(211,27,91,0.35)] transition hover:scale-[1.03] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={togglePanel}
        type="button"
      >
        <Calculator aria-hidden="true" className="h-7 w-7" />
        <span className="absolute -right-1 -top-1 inline-flex min-w-7 items-center justify-center rounded-full border border-white/20 bg-[rgba(18,5,13,0.98)] px-2 py-1 text-xs font-semibold text-white">
          {visibleSelections.length}
        </span>
      </button>
    </div>,
    document.body,
  );
}
