"use client";

import {
  type CalculatorLineFields,
  toNumber,
} from "./calculator-shared";

const calculatorConfigFieldClass =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_64px] items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-2.5 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_74px] sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm";

const calculatorConfigInputClass =
  "lz-input min-w-0 w-full rounded-xl px-2 py-1 text-right text-xs sm:py-1.5 sm:text-sm";

export function MemberConfigPanel({
  alwaysOpen = false,
  configExpanded,
  member,
  onChange,
  onToggleExpanded,
}: {
  alwaysOpen?: boolean;
  configExpanded: boolean;
  member: CalculatorLineFields;
  onChange: (patch: Partial<CalculatorLineFields>) => void;
  onToggleExpanded: () => void;
}) {
  const expanded = alwaysOpen || configExpanded;
  const hasCustomConfig =
    member.freebet ||
    toNumber(member.aumento_percentual) !== 0 ||
    toNumber(member.comissao_percentual) !== 0 ||
    toNumber(member.cashback_percentual) !== 0;

  return (
    <div
      className={`rounded-[24px] border p-3 transition ${
        hasCustomConfig
          ? "border-[rgba(255,119,163,0.24)] bg-[rgba(255,255,255,0.05)]"
          : "border-white/10 bg-white/4"
      }`}
    >
      {alwaysOpen ? (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Configurações
          </p>
          {hasCustomConfig ? (
            <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
          ) : null}
        </div>
      ) : (
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3"
        onClick={onToggleExpanded}
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
              expanded ? "rotate-180" : ""
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
      )}

      {expanded ? (
        <div className={alwaysOpen ? "mt-2.5 space-y-1.5" : "mt-3 space-y-2"}>
          <label className={calculatorConfigFieldClass}>
            <span className="min-w-0 text-[var(--text-secondary)]">Aumento (%)</span>
            <input
              className={calculatorConfigInputClass}
              onChange={(event) =>
                onChange({ aumento_percentual: event.target.value })
              }
              step="0.01"
              type="number"
              value={member.aumento_percentual}
            />
          </label>

          <label className={calculatorConfigFieldClass}>
            <span className="min-w-0 text-[var(--text-secondary)]">Comissão (%)</span>
            <input
              className={calculatorConfigInputClass}
              onChange={(event) =>
                onChange({ comissao_percentual: event.target.value })
              }
              step="0.01"
              type="number"
              value={member.comissao_percentual}
            />
          </label>

          <label className={calculatorConfigFieldClass}>
            <span className="min-w-0 text-[var(--text-secondary)]">Cashback (%)</span>
            <input
              className={calculatorConfigInputClass}
              onChange={(event) =>
                onChange({ cashback_percentual: event.target.value })
              }
              step="0.01"
              type="number"
              value={member.cashback_percentual}
            />
          </label>

          <label className={`${calculatorConfigFieldClass} cursor-pointer`}>
            <span className="min-w-0 text-[var(--text-secondary)]">Cashback só se perder</span>
            <span className="flex justify-end pr-1">
              <input
                checked={member.cashback_apenas_perda}
                className="lz-checkbox"
                onChange={(event) =>
                  onChange({ cashback_apenas_perda: event.target.checked })
                }
                type="checkbox"
              />
            </span>
          </label>

          <label className={`${calculatorConfigFieldClass} cursor-pointer`}>
            <span className="min-w-0 text-[var(--text-secondary)]">Freebet</span>
            <span className="flex justify-end pr-1">
              <input
                checked={member.freebet}
                className="lz-checkbox"
                onChange={(event) =>
                  onChange({ freebet: event.target.checked })
                }
                type="checkbox"
              />
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
