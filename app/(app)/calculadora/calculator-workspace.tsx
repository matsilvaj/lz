"use client";

import { calculateSurebet, suggestProcedureFromCalculator } from "@/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/app/_components/toast-provider";

import { LzSelect } from "../_components/lz-select";
import { ProcedureModal } from "../_components/procedure-modal";
import { formatCurrency } from "../_components/ui";

type CalculatorWorkspaceProps = {
  bookmakers: string[];
};

type CalculatorLine = {
  house: string;
  odd: string;
  stake: string;
  stakeEdited: boolean;
  tipo: "B" | "L";
  responsabilidade: string;
  responsabilidadeEdited: boolean;
  aumento_percentual: string;
  comissao_percentual: string;
  cashback_percentual: string;
  freebet: boolean;
};

type SharedCalculatorLine = Partial<Record<keyof CalculatorLine, unknown>>;

type SharedCalculatorPayload = {
  version?: number;
  lineCount?: number;
  workspaceIndex?: number;
  configExpanded?: boolean;
  lines?: SharedCalculatorLine[];
};

type BookmakerAutocompleteInputProps = {
  index: number;
  bookmakers: string[];
  onValueChange: (value: string) => void;
  value: string;
};

function createInitialLine(): CalculatorLine {
  return {
    house: "",
    odd: "2",
    stake: "100",
    stakeEdited: false,
    tipo: "B",
    responsabilidade: "0",
    responsabilidadeEdited: false,
    aumento_percentual: "0",
    comissao_percentual: "0",
    cashback_percentual: "0",
    freebet: false,
  };
}

function createConversionLine(house: string, freebetValue: number): CalculatorLine {
  return {
    ...createInitialLine(),
    house,
    stake: String(freebetValue || 0),
    freebet: true,
  };
}

function clampInteger(value: unknown, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function toSharedString(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function normalizeSharedCalculatorLine(line: SharedCalculatorLine): CalculatorLine {
  const initialLine = createInitialLine();

  return {
    house: toSharedString(line.house, initialLine.house),
    odd: toSharedString(line.odd, initialLine.odd),
    stake: toSharedString(line.stake, initialLine.stake),
    stakeEdited: Boolean(line.stakeEdited),
    tipo:
      toSharedString(line.tipo, initialLine.tipo).toUpperCase().startsWith("L")
        ? "L"
        : "B",
    responsabilidade: toSharedString(
      line.responsabilidade,
      initialLine.responsabilidade,
    ),
    responsabilidadeEdited: Boolean(line.responsabilidadeEdited),
    aumento_percentual: toSharedString(
      line.aumento_percentual,
      initialLine.aumento_percentual,
    ),
    comissao_percentual: toSharedString(
      line.comissao_percentual,
      initialLine.comissao_percentual,
    ),
    cashback_percentual: toSharedString(
      line.cashback_percentual,
      initialLine.cashback_percentual,
    ),
    freebet: Boolean(line.freebet),
  };
}

function encodeCalculatorPayload(payload: SharedCalculatorPayload) {
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

function decodeCalculatorPayload(value: string): SharedCalculatorPayload | null {
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

function copyTextFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 8.5A2.5 2.5 0 0 1 10.5 6h7A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-7A2.5 2.5 0 0 1 8 17.5v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5 15.5V6.5A2.5 2.5 0 0 1 7.5 4h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getProfitClass(value: number) {
  return value >= 0 ? "text-emerald-400" : "text-rose-400";
}

function formatPercent(value: number) {
  return `${value.toFixed(4)}%`;
}

function toNumber(value: string) {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCalculatedValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function roundCurrencyValue(value: number) {
  return Math.round(value * 100) / 100;
}

const calculatorConfigFieldClass =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_64px] items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-2.5 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_74px] sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm";

const calculatorConfigInputClass =
  "lz-input min-w-0 w-full rounded-xl px-2 py-1 text-right text-xs sm:py-1.5 sm:text-sm";

const maxCalculatorColumnsPerRow = 5;

function BookmakerAutocompleteInput({
  index,
  bookmakers,
  onValueChange,
  value,
}: BookmakerAutocompleteInputProps) {
  const generatedId = useId();
  const menuId = `${generatedId}-bookmaker-menu`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const normalizedValue = value.trim().toLowerCase();
  const visibleBookmakers = useMemo(() => {
    const availableBookmakers = bookmakers.filter(Boolean);

    if (!normalizedValue) {
      return availableBookmakers.slice(0, 10);
    }

    return availableBookmakers
      .filter((bookmaker) =>
        bookmaker.toLowerCase().includes(normalizedValue),
      )
      .slice(0, 10);
  }, [bookmakers, normalizedValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = inputRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (inputRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(bookmaker: string) {
    onValueChange(bookmaker);
    setOpen(false);
  }

  return (
    <>
      <input
        aria-autocomplete="list"
        aria-controls={menuId}
        aria-expanded={open}
        className="calculator-house-input min-w-0 flex-1 rounded-lg bg-transparent px-0 text-base font-semibold text-white outline-none"
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={`Casa ${index + 1}`}
        ref={inputRef}
        role="combobox"
        type="text"
        value={value}
      />

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90]"
              style={{
                left: `${menuStyle.left}px`,
                top: `${menuStyle.top}px`,
                width: `${menuStyle.width}px`,
              }}
            >
              <div
                className="rounded-[22px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                id={menuId}
                ref={menuRef}
                role="listbox"
              >
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {visibleBookmakers.length > 0 ? (
                    visibleBookmakers.map((bookmaker) => {
                      const active = bookmaker === value;

                      return (
                        <button
                          aria-selected={active}
                          className={`flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-left text-sm transition ${
                            active
                              ? "border border-[rgba(255,119,163,0.18)] bg-[rgba(216,31,89,0.18)] text-white"
                              : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                          }`}
                          key={bookmaker}
                          onClick={() => handleSelect(bookmaker)}
                          role="option"
                          type="button"
                        >
                          <span className="min-w-0 truncate">{bookmaker}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      Nenhuma casa encontrada.
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function CalculatorWorkspace({ bookmakers }: CalculatorWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const conversionPreset = useMemo(() => {
    if (searchParams.get("mode") !== "convert-freebet") {
      return null;
    }

    const house = searchParams.get("house") ?? "";
    const freebetValue = Number(searchParams.get("freebetValue") ?? 0);
    const entryValue = Number(searchParams.get("entryValue") ?? 0);
    const originIds = searchParams
      .getAll("originIds")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
    const key = JSON.stringify({
      house,
      freebetValue,
      entryValue,
      originIds,
    });

    return {
      key,
      house,
      freebetValue: Number.isFinite(freebetValue) ? freebetValue : 0,
      entryValue: Number.isFinite(entryValue) ? entryValue : 0,
      originIds,
    };
  }, [searchParams]);
  const sharedPreset = useMemo(() => {
    const sharedValue = searchParams.get("calc");

    if (!sharedValue) {
      return null;
    }

    const payload = decodeCalculatorPayload(sharedValue);

    if (!payload || !Array.isArray(payload.lines)) {
      return null;
    }

    const sharedLines = payload.lines
      .slice(0, 10)
      .map((line) => normalizeSharedCalculatorLine(line));

    if (sharedLines.length === 0) {
      return null;
    }

    const nextLineCount = clampInteger(
      payload.lineCount ?? sharedLines.length,
      2,
      10,
    );
    const linesWithMinimum = [...sharedLines];

    while (linesWithMinimum.length < nextLineCount) {
      linesWithMinimum.push(createInitialLine());
    }

    return {
      key: `shared:${sharedValue}`,
      lineCount: nextLineCount,
      workspaceIndex: clampInteger(payload.workspaceIndex, 0, nextLineCount - 1),
      configExpanded: Boolean(payload.configExpanded),
      lines: linesWithMinimum.slice(0, nextLineCount),
    };
  }, [searchParams]);
  const appliedPresetRef = useRef<string | null>(null);
  const [lineCount, setLineCount] = useState(() => sharedPreset?.lineCount ?? 2);
  const [workspaceIndex, setWorkspaceIndex] = useState(
    () => sharedPreset?.workspaceIndex ?? 0,
  );
  const [configExpanded, setConfigExpanded] = useState(
    () => sharedPreset?.configExpanded ?? false,
  );
  const [lines, setLines] = useState<CalculatorLine[]>(() =>
    sharedPreset
      ? sharedPreset.lines
      : conversionPreset
      ? [createConversionLine(conversionPreset.house, conversionPreset.freebetValue), createInitialLine()]
      : [createInitialLine(), createInitialLine()],
  );

  useEffect(() => {
    if (sharedPreset) {
      if (appliedPresetRef.current === sharedPreset.key) {
        return;
      }

      setLineCount(sharedPreset.lineCount);
      setWorkspaceIndex(sharedPreset.workspaceIndex);
      setConfigExpanded(sharedPreset.configExpanded);
      setLines(sharedPreset.lines);
      appliedPresetRef.current = sharedPreset.key;
      return;
    }

    if (!conversionPreset) {
      appliedPresetRef.current = null;
      return;
    }

    if (appliedPresetRef.current === conversionPreset.key) {
      return;
    }

    setLineCount(2);
    setWorkspaceIndex(0);
    setConfigExpanded(false);
    setLines([
      createConversionLine(conversionPreset.house, conversionPreset.freebetValue),
      createInitialLine(),
    ]);
    appliedPresetRef.current = conversionPreset.key;
  }, [sharedPreset, conversionPreset]);

  function updateLine(index: number, patch: Partial<CalculatorLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function resetCalculator() {
    if (conversionPreset || sharedPreset) {
      appliedPresetRef.current = null;
      router.replace(pathname);
    }

    setLineCount(2);
    setWorkspaceIndex(0);
    setConfigExpanded(false);
    setLines([createInitialLine(), createInitialLine()]);
  }

  function updateLineCount(nextCount: number) {
    setLineCount(nextCount);
    setLines((current) => {
      if (nextCount <= current.length) {
        return current.slice(0, nextCount);
      }

      const additional = Array.from(
        { length: nextCount - current.length },
        () => createInitialLine(),
      );

      return [...current, ...additional];
    });
    setWorkspaceIndex((current) => Math.min(current, nextCount - 1));
  }

  function toggleLineType(index: number) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        const nextType = line.tipo === "B" ? "L" : "B";
        if (nextType === "L") {
          setConfigExpanded(true);
        }

        return {
          ...line,
          tipo: nextType,
          responsabilidade: nextType === "B" ? "0" : line.responsabilidade,
          responsabilidadeEdited: false,
        };
      }),
    );
  }

  function handleStakeChange(index: number, value: string) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              stake: value,
              stakeEdited: lineIndex !== workspaceIndex,
              responsabilidadeEdited:
                line.tipo === "L" ? false : line.responsabilidadeEdited,
            }
          : line,
      ),
    );
  }

  function handleResponsabilidadeChange(index: number, value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        const odd = toNumber(line.odd);
        const responsibility = toNumber(value);
        const syncedStake =
          odd > 1 && value !== ""
            ? formatCalculatedValue(responsibility / (odd - 1))
            : line.stake;

        return {
          ...line,
          responsabilidade: value,
          responsabilidadeEdited: true,
          stake: syncedStake,
          stakeEdited: lineIndex !== workspaceIndex,
        };
      }),
    );
  }

  function fixStake(index: number, stake: string) {
    setLines((current) =>
      current.map((line, lineIndex) => ({
        ...line,
        stake: lineIndex === index ? stake : line.stake,
        stakeEdited: false,
        responsabilidadeEdited: false,
      })),
    );
    setWorkspaceIndex(index);
  }

  async function copyCalculationLink() {
    if (typeof window === "undefined") {
      return;
    }

    const payload: SharedCalculatorPayload = {
      version: 1,
      lineCount,
      workspaceIndex,
      configExpanded,
      lines: lines.slice(0, lineCount).map((line) => ({
        house: line.house,
        odd: line.odd,
        stake: line.stake,
        stakeEdited: line.stakeEdited,
        tipo: line.tipo,
        responsabilidade: line.responsabilidade,
        responsabilidadeEdited: line.responsabilidadeEdited,
        aumento_percentual: line.aumento_percentual,
        comissao_percentual: line.comissao_percentual,
        cashback_percentual: line.cashback_percentual,
        freebet: line.freebet,
      })),
    };
    const params = new URLSearchParams();
    params.set("calc", encodeCalculatorPayload(payload));
    const shareUrl = `${window.location.origin}${pathname}?${params.toString()}`;

    try {
      let copied = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        copied = copyTextFallback(shareUrl);
      }

      if (!copied) {
        throw new Error("Clipboard unavailable");
      }

      showToast({
        title: "Link do cálculo copiado.",
        tone: "success",
      });
    } catch {
      showToast({
        title: "Não foi possível copiar o link.",
        tone: "error",
      });
    }
  }

  let calculationError = "";
  let calculation = null;

  try {
    calculation = calculateSurebet(
      lines.map((line, index) => ({
        odd: toNumber(line.odd),
        stake:
          index === workspaceIndex || line.stakeEdited ? toNumber(line.stake) : 0,
        tipo: line.tipo,
        responsabilidade: toNumber(line.responsabilidade),
        aumento_percentual: toNumber(line.aumento_percentual),
        comissao_percentual: toNumber(line.comissao_percentual),
        cashback_percentual: toNumber(line.cashback_percentual),
        freebet: line.freebet,
      })),
      workspaceIndex,
    );
  } catch (error) {
    calculationError =
      error instanceof Error ? error.message : "Não foi possível calcular.";
  }

  const stakeTotal =
    calculation?.linhas?.reduce((total, line) => total + Number(line.stake ?? 0), 0) ?? 0;
  const hasLayLine = lines.some((line) => line.tipo === "L");
  const housesText = lines
    .map((line) => line.house.trim())
    .filter(Boolean)
    .join(", ");

  const suggestedProcedure = calculation
    ? suggestProcedureFromCalculator({
        baseProfit: calculation.lucro_liquido,
        useDouble: conversionPreset ? false : calculation.duplo_calculado_final > 0,
        doubleValue: calculation.duplo_calculado_final,
        freebetHouse: conversionPreset?.house ?? "",
      })
    : null;
  const columnsPerRow = Math.min(lineCount, maxCalculatorColumnsPerRow);

  return (
    <div className="space-y-5">
      <div className="lz-panel flex flex-wrap items-center gap-3 rounded-[28px] p-4">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Casas</p>
        <LzSelect
          className="rounded-full px-4 py-2.5 text-sm font-medium"
          onValueChange={(value) => updateLineCount(Number(value))}
          options={[
            { value: "2", label: "2 casas" },
            { value: "3", label: "3 casas" },
            { value: "4", label: "4 casas" },
            { value: "5", label: "5 casas" },
            { value: "6", label: "6 casas" },
            { value: "7", label: "7 casas" },
            { value: "8", label: "8 casas" },
            { value: "9", label: "9 casas" },
            { value: "10", label: "10 casas" },
          ]}
          value={String(lineCount)}
        />
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid items-stretch gap-4"
          style={{
            gridTemplateColumns: `repeat(${columnsPerRow}, minmax(220px, 1fr))`,
            minWidth: `${columnsPerRow * 220 + (columnsPerRow - 1) * 16}px`,
          }}
        >
        {lines.map((line, index) => {
          const lineResult = calculation?.linhas?.[index];
          const lineProfit = Number(lineResult?.lucro_liquido ?? 0);
          const lineInvestment =
            Number(lineResult?.custo ?? 0) - Number(lineResult?.cashback ?? 0);
          const roundedLineProfit = roundCurrencyValue(lineProfit);
          const roundedLineInvestment = roundCurrencyValue(lineInvestment);
          const lineRoi =
            lineResult && roundedLineInvestment > 0
              ? (roundedLineProfit / roundedLineInvestment) * 100
              : 0;
          const hasCustomConfig =
            line.freebet ||
            toNumber(line.aumento_percentual) > 0 ||
            toNumber(line.comissao_percentual) > 0 ||
            toNumber(line.cashback_percentual) > 0;
          const displayedStake =
            index === workspaceIndex
              ? line.stake
              : line.stakeEdited
                ? line.stake
              : lineResult
                ? formatCalculatedValue(lineResult.stake)
                : line.stake;
          const displayedResponsabilidade =
            line.responsabilidadeEdited || !lineResult
              ? line.responsabilidade
              : formatCalculatedValue(lineResult.responsabilidade);

          return (
            <div
              className="lz-panel-subtle flex h-full min-w-0 flex-col gap-4 overflow-hidden rounded-[28px] p-4"
              key={`calculator-line-${index}`}
            >
              <div className="flex items-center justify-between">
                <BookmakerAutocompleteInput
                  bookmakers={bookmakers}
                  index={index}
                  onValueChange={(house) => updateLine(index, { house })}
                  value={line.house}
                />
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-[var(--text-secondary)]">Odd</span>
                  <input
                    className="lz-input w-full rounded-2xl px-3 py-3 text-white"
                    onChange={(event) => updateLine(index, { odd: event.target.value })}
                    step="0.01"
                    type="number"
                    value={line.odd}
                  />
                </label>

                <div
                  className={
                    hasLayLine ? "flex min-h-[156px] flex-col justify-center gap-4" : "space-y-4"
                  }
                >
                  {line.tipo === "L" ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-[var(--text-secondary)]">Responsabilidade</span>
                      <input
                        className="lz-input w-full rounded-2xl px-3 py-3 text-white"
                        onChange={(event) =>
                          handleResponsabilidadeChange(index, event.target.value)
                        }
                        step="0.01"
                        type="number"
                        value={displayedResponsabilidade}
                      />
                    </label>
                  ) : null}

                  <div className="space-y-2 text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">Stake</span>
                    <div className="flex gap-2">
                      <input
                        className="lz-input w-full rounded-2xl px-3 py-3 text-white"
                        onChange={(event) => handleStakeChange(index, event.target.value)}
                        step="0.01"
                        type="number"
                        value={displayedStake}
                      />
                      <button
                        className="lz-button-secondary min-w-11 rounded-2xl px-3 py-2.5 text-sm font-semibold"
                        onClick={() => toggleLineType(index)}
                        type="button"
                      >
                        {line.tipo}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-[24px] border p-3 transition ${
                  hasCustomConfig
                    ? "border-[rgba(255,119,163,0.24)] bg-[rgba(255,255,255,0.05)]"
                    : "border-white/10 bg-white/4"
                }`}
              >
                <button
                  aria-expanded={configExpanded}
                  className="flex w-full items-center justify-between gap-3"
                  onClick={() => setConfigExpanded((current) => !current)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      Configurações
                    </p>
                    {hasCustomConfig ? (
                      <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
                    ) : null}
                  </div>
                  <svg
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-[var(--text-dim)] transition ${
                      configExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M6.75 9.75 12 15l5.25-5.25"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>

                {configExpanded ? (
                  <div className="mt-3 space-y-3">
                    <label className={calculatorConfigFieldClass}>
                      <span className="min-w-0 text-[var(--text-secondary)]">Aumento (%)</span>
                      <input
                        className={calculatorConfigInputClass}
                        onChange={(event) =>
                          updateLine(index, { aumento_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.aumento_percentual}
                      />
                    </label>

                    <label className={calculatorConfigFieldClass}>
                      <span className="min-w-0 text-[var(--text-secondary)]">Comissão (%)</span>
                      <input
                        className={calculatorConfigInputClass}
                        onChange={(event) =>
                          updateLine(index, { comissao_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.comissao_percentual}
                      />
                    </label>

                    <label className={calculatorConfigFieldClass}>
                      <span className="min-w-0 text-[var(--text-secondary)]">Cashback (%)</span>
                      <input
                        className={calculatorConfigInputClass}
                        onChange={(event) =>
                          updateLine(index, { cashback_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.cashback_percentual}
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                      <input
                        checked={line.freebet}
                        onChange={(event) =>
                          updateLine(index, { freebet: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span className="text-[var(--text-secondary)]">Freebet</span>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/4 p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Resultado
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Lucro</span>
                    <span className={`font-semibold ${getProfitClass(lineProfit)}`}>
                      {formatCurrency(lineProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">ROI</span>
                    <span className="font-semibold text-white">
                      {formatPercent(lineRoi)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={`w-full rounded-[24px] px-4 py-3 text-sm font-semibold transition ${
                  index === workspaceIndex
                    ? "lz-button-primary"
                    : "lz-button-secondary"
                }`}
                onClick={() => fixStake(index, displayedStake)}
                type="button"
              >
                {index === workspaceIndex ? "Stake Fixa" : "Fixar Stake"}
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {calculationError ? (
        <div className="rounded-[28px] border border-[rgba(255,107,133,0.24)] bg-[rgba(41,13,21,0.94)] px-5 py-4">
          <p className="text-sm font-medium text-[var(--negative)]">Cálculo indisponível</p>
          <p className="mt-2 text-sm leading-7 text-[#f7a1b5]">{calculationError}</p>
        </div>
      ) : calculation ? (
        <div className="lz-panel space-y-4 rounded-[30px] p-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-medium"
              onClick={resetCalculator}
              type="button"
            >
              Limpar
            </button>

            <button
              aria-label="Copiar cálculo"
              className="lz-button-secondary inline-flex h-11 w-11 items-center justify-center rounded-full p-0 text-[var(--text-secondary)] transition"
              onClick={copyCalculationLink}
              title="Copiar cálculo"
              type="button"
            >
              <CopyIcon />
            </button>

            <ProcedureModal
              bookmakers={bookmakers}
              defaultValues={{
                procedureType: conversionPreset
                  ? "Converter Freebet"
                  : ((suggestedProcedure?.tipo as
                      | "SureBet"
                      | "Tentativa de Duplo"
                      | "Converter Freebet"
                      | "Coletar Freebet"
                      | "Cassino") ?? "SureBet"),
                houses: housesText,
                entryValue: conversionPreset
                  ? calculation.lucro_liquido
                  : (suggestedProcedure?.lucro_base ?? 0),
                doubleValue: calculation.duplo_calculado_final,
                hitDouble: calculation.duplo_calculado_final > 0,
                freebetHouse: conversionPreset?.house ?? "",
                freebetValue: conversionPreset?.freebetValue ?? 0,
                originIds: conversionPreset?.originIds ?? [],
              }}
              returnTo="/calculadora"
              submitLabel="Criar procedimento"
              title="Novo procedimento"
              triggerClassName="lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
              triggerLabel="Novo procedimento"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">Stake total</p>
              <p className="mt-2 text-xl font-semibold text-white md:text-2xl">
                {formatCurrency(stakeTotal)}
              </p>
            </div>

            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">Lucro</p>
              <p className={`mt-2 text-xl font-semibold ${getProfitClass(calculation.lucro_liquido)} md:text-2xl`}>
                {formatCurrency(calculation.lucro_liquido)}
              </p>
            </div>

            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">ROI</p>
              <p className="mt-2 text-xl font-semibold text-white md:text-2xl">
                {calculation.lucro_percentual.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
