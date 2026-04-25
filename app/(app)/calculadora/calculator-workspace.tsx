"use client";

import { calculateSurebet, suggestProcedureFromCalculator } from "@/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  aumento_percentual: string;
  comissao_percentual: string;
  cashback_percentual: string;
  freebet: boolean;
};

function createInitialLine(index: number): CalculatorLine {
  return {
    house: `Casa ${index + 1}`,
    odd: "2",
    stake: "100",
    stakeEdited: false,
    tipo: "B",
    responsabilidade: "0",
    aumento_percentual: "0",
    comissao_percentual: "0",
    cashback_percentual: "0",
    freebet: false,
  };
}

function createConversionLine(house: string, freebetValue: number): CalculatorLine {
  return {
    ...createInitialLine(0),
    house: house || "Casa 1",
    stake: String(freebetValue || 0),
    freebet: true,
  };
}

function getProfitClass(value: number) {
  return value >= 0 ? "text-emerald-400" : "text-rose-400";
}

function formatPercent(value: number) {
  return `${value.toFixed(4)}%`;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CalculatorWorkspace({ bookmakers }: CalculatorWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const appliedPresetRef = useRef<string | null>(null);
  const [lineCount, setLineCount] = useState(2);
  const [baseIndex, setBaseIndex] = useState(0);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [lines, setLines] = useState<CalculatorLine[]>(() =>
    conversionPreset
      ? [createConversionLine(conversionPreset.house, conversionPreset.freebetValue), createInitialLine(1)]
      : [createInitialLine(0), createInitialLine(1)],
  );

  useEffect(() => {
    if (!conversionPreset) {
      appliedPresetRef.current = null;
      return;
    }

    if (appliedPresetRef.current === conversionPreset.key) {
      return;
    }

    setLineCount(2);
    setBaseIndex(0);
    setConfigExpanded(false);
    setLines([
      createConversionLine(conversionPreset.house, conversionPreset.freebetValue),
      createInitialLine(1),
    ]);
    appliedPresetRef.current = conversionPreset.key;
  }, [conversionPreset]);

  function updateLine(index: number, patch: Partial<CalculatorLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function resetCalculator() {
    if (conversionPreset) {
      appliedPresetRef.current = null;
      router.replace(pathname);
    }

    setLineCount(2);
    setBaseIndex(0);
    setConfigExpanded(false);
    setLines([createInitialLine(0), createInitialLine(1)]);
  }

  function updateLineCount(nextCount: number) {
    setLineCount(nextCount);
    setLines((current) => {
      if (nextCount <= current.length) {
        return current.slice(0, nextCount);
      }

      const additional = Array.from(
        { length: nextCount - current.length },
        (_, index) => createInitialLine(current.length + index),
      );

      return [...current, ...additional];
    });
    setBaseIndex((current) => Math.min(current, nextCount - 1));
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

        return { ...line, tipo: nextType };
      }),
    );
  }

  function handleStakeChange(index: number, value: string) {
    updateLine(index, { stake: value, stakeEdited: index !== baseIndex });
  }

  function fixStake(index: number, stake: string) {
    setLines((current) =>
      current.map((line, lineIndex) => ({
        ...line,
        stake: lineIndex === index ? stake : line.stake,
        stakeEdited: false,
      })),
    );
    setBaseIndex(index);
  }

  let calculationError = "";
  let calculation = null;

  try {
    calculation = calculateSurebet(
      lines.map((line, index) => ({
        odd: toNumber(line.odd),
        stake: index === baseIndex ? toNumber(line.stake) : 0,
        tipo: line.tipo,
        responsabilidade: toNumber(line.responsabilidade),
        aumento_percentual: toNumber(line.aumento_percentual),
        comissao_percentual: toNumber(line.comissao_percentual),
        cashback_percentual: toNumber(line.cashback_percentual),
        freebet: line.freebet,
      })),
      baseIndex,
    );
  } catch (error) {
    calculationError =
      error instanceof Error ? error.message : "Nao foi possivel calcular.";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-neutral-700">Casas</p>
        <select
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-950"
          onChange={(event) => updateLineCount(Number(event.target.value))}
          value={lineCount}
        >
          <option value={2}>2 casas</option>
          <option value={3}>3 casas</option>
          <option value={4}>4 casas</option>
          <option value={5}>5 casas</option>
          <option value={6}>6 casas</option>
        </select>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid items-stretch gap-4"
          style={{
            gridTemplateColumns: `repeat(${lineCount}, minmax(220px, 1fr))`,
            minWidth: `${lineCount * 220 + (lineCount - 1) * 16}px`,
          }}
        >
        {lines.map((line, index) => {
          const lineResult = calculation?.linhas?.[index];
          const lineProfit = Number(lineResult?.lucro_liquido ?? 0);
          const lineRoi =
            calculation && calculation.investimento_efetivo > 0
              ? (lineProfit / calculation.investimento_efetivo) * 100
              : 0;
          const hasCustomConfig =
            line.freebet ||
            toNumber(line.aumento_percentual) > 0 ||
            toNumber(line.comissao_percentual) > 0 ||
            toNumber(line.cashback_percentual) > 0;
          const displayedStake =
            index === baseIndex
              ? line.stake
              : line.stakeEdited
                ? line.stake
              : lineResult
                ? Number(lineResult.stake).toFixed(2)
                : line.stake;

          return (
            <div
              className="flex h-full min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4"
              key={`${line.house}-${index}`}
            >
              <div className="flex items-center justify-between">
                <input
                  className="calculator-house-input min-w-0 flex-1 rounded-lg bg-transparent px-0 text-base font-semibold text-neutral-950 outline-none"
                  list={`calculator-houses-${index}`}
                  onChange={(event) => updateLine(index, { house: event.target.value })}
                  type="text"
                  value={line.house}
                />
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <datalist id={`calculator-houses-${index}`}>
                  {bookmakers.map((bookmaker) => (
                    <option key={`${index}-${bookmaker}`} value={bookmaker} />
                  ))}
                </datalist>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-700">Odd</span>
                  <input
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none transition focus:border-neutral-950"
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
                      <span className="font-medium text-neutral-700">Responsabilidade</span>
                      <input
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none transition focus:border-neutral-950"
                        onChange={(event) =>
                          updateLine(index, { responsabilidade: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.responsabilidade}
                      />
                    </label>
                  ) : null}

                  <div className="space-y-2 text-sm">
                    <span className="font-medium text-neutral-700">Stake</span>
                    <div className="flex gap-2">
                      <input
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-950 outline-none transition focus:border-neutral-950"
                        onChange={(event) => handleStakeChange(index, event.target.value)}
                        step="0.01"
                        type="number"
                        value={displayedStake}
                      />
                      <button
                        className="min-w-11 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-950"
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
                className={`rounded-2xl border p-3 transition ${
                  hasCustomConfig
                    ? "border-neutral-950 bg-neutral-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <button
                  className="flex w-full items-center"
                  onClick={() => setConfigExpanded((current) => !current)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-700">
                      Configuracoes
                    </p>
                    {hasCustomConfig ? (
                      <span className="h-2 w-2 rounded-full bg-neutral-950" />
                    ) : null}
                  </div>
                </button>

                {configExpanded ? (
                  <div className="mt-3 space-y-3">
                    <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                      <span className="min-w-0 text-neutral-700">Aumento (%)</span>
                      <input
                        className="min-w-0 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-right text-neutral-950 outline-none transition focus:border-neutral-950"
                        onChange={(event) =>
                          updateLine(index, { aumento_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.aumento_percentual}
                      />
                    </label>

                    <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                      <span className="min-w-0 text-neutral-700">Comissao (%)</span>
                      <input
                        className="min-w-0 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-right text-neutral-950 outline-none transition focus:border-neutral-950"
                        onChange={(event) =>
                          updateLine(index, { comissao_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.comissao_percentual}
                      />
                    </label>

                    <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                      <span className="min-w-0 text-neutral-700">Cashback (%)</span>
                      <input
                        className="min-w-0 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-right text-neutral-950 outline-none transition focus:border-neutral-950"
                        onChange={(event) =>
                          updateLine(index, { cashback_percentual: event.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={line.cashback_percentual}
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm">
                      <input
                        checked={line.freebet}
                        onChange={(event) =>
                          updateLine(index, { freebet: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span className="text-neutral-700">Freebet</span>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium text-neutral-700">
                    Resultado
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm">
                    <span className="text-neutral-700">Lucro</span>
                    <span className={`font-semibold ${getProfitClass(lineProfit)}`}>
                      {formatCurrency(lineProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm">
                    <span className="text-neutral-700">ROI</span>
                    <span className="font-semibold text-neutral-950">
                      {formatPercent(lineRoi)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  index === baseIndex
                    ? "bg-neutral-950 text-white hover:bg-neutral-800"
                    : "border border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
                }`}
                onClick={() => fixStake(index, displayedStake)}
                type="button"
              >
                {index === baseIndex ? "Stake Fixa" : "Fixar Stake"}
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {calculationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-medium text-red-700">Calculo indisponivel</p>
          <p className="mt-2 text-sm leading-6 text-red-600">{calculationError}</p>
        </div>
      ) : calculation ? (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
              onClick={resetCalculator}
              type="button"
            >
              Limpar
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
              triggerClassName="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
              triggerLabel="Novo procedimento"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-500">Stake total</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-950">
                {formatCurrency(stakeTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-500">Lucro</p>
              <p className={`mt-2 text-2xl font-semibold ${getProfitClass(calculation.lucro_liquido)}`}>
                {formatCurrency(calculation.lucro_liquido)}
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-500">ROI</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-950">
                {calculation.lucro_percentual.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
