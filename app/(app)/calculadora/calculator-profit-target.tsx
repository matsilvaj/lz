"use client";

import { Target } from "lucide-react";

import { formatCurrency } from "../_components/ui";

import {
  type CalculatorLine,
  OptionHint,
  type ProfitTargetMode,
  toNumber,
} from "./calculator-shared";

function getProfitTargetLabel(line: CalculatorLine) {
  if (line.targetMode === "zerar") {
    return "Zerar";
  }

  if (line.targetMode === "valor" && line.targetValue.trim() !== "") {
    return line.targetUnit === "%"
      ? `${line.targetValue}% do lucro`
      : formatCurrency(toNumber(line.targetValue));
  }

  if (line.targetMode === "valor") {
    return "Definir";
  }

  return "Normal";
}

export function ProfitTargetPanel({
  index,
  isBaseLine,
  line,
  onChange,
  onToggleOpen,
  open,
}: {
  index: number;
  isBaseLine: boolean;
  line: CalculatorLine;
  onChange: (
    patch: Partial<Pick<CalculatorLine, "targetMode" | "targetUnit" | "targetValue">>,
  ) => void;
  onToggleOpen: () => void;
  open: boolean;
}) {
  const active = line.targetMode !== "normal";
  const hasFreeStake =
    isBaseLine ||
    !line.stakeEdited ||
    line.children.some((child) => !child.stakeEdited);
  const options: Array<{ mode: ProfitTargetMode; label: string }> = [
    { mode: "zerar", label: "Zerar lucro" },
    { mode: "valor", label: "Definir Lucro" },
  ];

  return (
    <div
      className={`rounded-[24px] border p-3 transition ${
        active
          ? "border-[rgba(255,119,163,0.24)] bg-[rgba(255,255,255,0.05)]"
          : "border-white/10 bg-white/4"
      }`}
    >
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-sm"
        onClick={onToggleOpen}
        type="button"
      >
        <span className="inline-flex items-center gap-2 font-medium text-[var(--text-secondary)]">
          <OptionHint
            description="Define quanto esta casa deve lucrar se bater: normal, zerado, um valor em R$ ou uma % do lucro das outras casas."
            icon={<Target aria-hidden="true" className="h-3.5 w-3.5" />}
            title="Lucro alvo"
          />
          Lucro alvo
          {active ? (
            <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
          ) : null}
        </span>
        <span
          className={`truncate text-xs ${active ? "text-[#ff9bbd]" : "text-[var(--text-dim)]"}`}
        >
          {getProfitTargetLabel(line)}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-1.5">
          {options.map((option) => {
            const selected = line.targetMode === option.mode;

            return (
              <div
                className={`rounded-2xl border px-3 py-2.5 text-sm transition ${
                  selected
                    ? "border-[rgba(255,119,163,0.4)] bg-[rgba(216,31,89,0.1)]"
                    : "border-white/10 bg-white/4 hover:border-white/20"
                }`}
                key={option.mode}
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    checked={selected}
                    className="lz-checkbox"
                    name={`profit-target-${index}-${option.mode}`}
                    // Marcar troca o alvo; desmarcar volta para o lucro normal.
                    onChange={() =>
                      onChange({ targetMode: selected ? "normal" : option.mode })
                    }
                    type="checkbox"
                  />
                  <span className="text-[var(--text-secondary)]">{option.label}</span>
                </label>

                {selected && option.mode === "valor" ? (
                  <div className="mt-2.5 flex gap-2">
                    <input
                      className="lz-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white"
                      onChange={(event) =>
                        onChange({ targetValue: event.target.value })
                      }
                      placeholder={line.targetUnit === "%" ? "50" : "0,00"}
                      step="0.01"
                      type="number"
                      value={line.targetValue}
                    />
                    <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/4 p-0.5">
                      {(["R$", "%"] as const).map((unit) => (
                        <button
                          className={`rounded-lg px-2.5 text-xs font-semibold transition ${
                            line.targetUnit === unit
                              ? "lz-button-primary"
                              : "text-[var(--text-dim)] hover:text-white"
                          }`}
                          key={unit}
                          onClick={() => onChange({ targetUnit: unit })}
                          type="button"
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {active && !hasFreeStake ? (
        <p className="mt-2 text-xs text-[var(--warning)]">
          Destrave uma stake desta casa para aplicar o lucro alvo.
        </p>
      ) : null}
    </div>
  );
}
