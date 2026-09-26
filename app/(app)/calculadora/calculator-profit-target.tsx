"use client";

import { Target } from "lucide-react";

import { formatCurrency } from "../_components/ui";

import { ProfitTargetOptions } from "../_components/profit-target-control";

import {
  type CalculatorLine,
  OptionHint,
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
        <div className="mt-3">
          <ProfitTargetOptions
            name={`profit-target-${index}`}
            onChange={(patch) =>
              onChange({
                ...(patch.mode ? { targetMode: patch.mode } : {}),
                ...(patch.unit ? { targetUnit: patch.unit } : {}),
                ...(patch.value !== undefined ? { targetValue: patch.value } : {}),
              })
            }
            target={{
              mode: line.targetMode,
              unit: line.targetUnit,
              value: line.targetValue,
            }}
          />
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
