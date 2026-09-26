"use client";

import { Settings } from "lucide-react";

import {
  type BetSide,
  parseDecimalInput,
} from "./procedure-form-utils";

function formatDecimalDisplay(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return "";
  }

  return value.toFixed(fractionDigits).replace(".", ",");
}

export function SportsBetFields({
  stakeName,
  oddName,
  stakeValue,
  oddValue,
  side,
  layOddValue,
  commissionValue,
  increaseValue,
  cashbackValue,
  cashbackLossOnlyChecked,
  freebetChecked,
  configOpen,
  onStakeChange,
  onOddChange,
  onToggleSide,
  onLayOddChange,
  onCommissionChange,
  onIncreaseChange,
  onCashbackChange,
  onCashbackLossOnlyChange,
  onFreebetChange,
  onToggleConfig,
}: {
  stakeName: string;
  oddName: string;
  stakeValue: string;
  oddValue: string;
  side: BetSide;
  layOddValue: string;
  commissionValue: string;
  increaseValue: string;
  cashbackValue: string;
  cashbackLossOnlyChecked: boolean;
  freebetChecked: boolean;
  configOpen: boolean;
  onStakeChange: (value: string) => void;
  onOddChange: (value: string) => void;
  onToggleSide: () => void;
  onLayOddChange: (value: string) => void;
  onCommissionChange: (value: string) => void;
  onIncreaseChange: (value: string) => void;
  onCashbackChange: (value: string) => void;
  onCashbackLossOnlyChange: (checked: boolean) => void;
  onFreebetChange: (checked: boolean) => void;
  onToggleConfig: () => void;
}) {
  const isLay = side === "lay";
  const displayedOddValue = isLay ? (layOddValue || oddValue) : oddValue;
  const responsibilityValue = stakeValue;
  const layOddNumber = parseDecimalInput(displayedOddValue);
  const responsibilityNumber = parseDecimalInput(responsibilityValue);
  const displayedLayStake =
    isLay && layOddNumber > 1
      ? formatDecimalDisplay(responsibilityNumber / (layOddNumber - 1))
      : "";
  const hasCustomConfig =
    parseDecimalInput(increaseValue) !== 0 ||
    parseDecimalInput(commissionValue) !== 0 ||
    parseDecimalInput(cashbackValue) !== 0 ||
    freebetChecked;
  const configFieldClass =
    "flex min-h-[84px] flex-col justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm";

  return (
    <>
      {isLay ? (
        <label className="min-w-0 space-y-2 text-sm sm:col-span-2">
          <span className="block text-[var(--text-muted)]">
            Responsabilidade
          </span>
          <input
            className="lz-input w-full rounded-2xl px-3 py-3"
            inputMode="decimal"
            name={stakeName}
            onChange={(event) => onStakeChange(event.target.value)}
            placeholder="0,00"
            value={responsibilityValue}
          />
        </label>
      ) : (
        <label className="min-w-0 space-y-2 text-sm">
          <span className="block text-[var(--text-muted)]">Stake</span>
          <input
            className="lz-input w-full rounded-2xl px-3 py-3"
            inputMode="decimal"
            name={stakeName}
            onChange={(event) => onStakeChange(event.target.value)}
            placeholder="0,00"
            value={stakeValue}
          />
        </label>
      )}

      <div className="min-w-0 space-y-2 text-sm">
        <span className="block text-[var(--text-muted)]">
          {isLay ? "Stake" : "Odd"}
        </span>
        {isLay ? (
          <input
            className="lz-input min-w-0 w-full rounded-2xl px-3 py-3"
            inputMode="decimal"
            onChange={(event) => {
              const nextStake = parseDecimalInput(event.target.value);
              const effectiveOdd = parseDecimalInput(displayedOddValue);

              if (effectiveOdd > 1) {
                onStakeChange(
                  formatDecimalDisplay(nextStake * (effectiveOdd - 1)),
                );
              }
            }}
            placeholder="0,00"
            value={displayedLayStake}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:grid-cols-[minmax(0,1fr)_48px_48px]">
            <input
              className="lz-input min-w-0 flex-1 rounded-2xl px-3 py-3"
              inputMode="decimal"
              name={oddName}
              onChange={(event) => onOddChange(event.target.value)}
              placeholder="0.000"
              value={displayedOddValue}
            />
            <button
              aria-label="Alternar para lay"
              className="lz-button-primary rounded-2xl px-2 py-3 text-sm font-bold transition sm:px-3"
              onClick={onToggleSide}
              title="Back"
              type="button"
            >
              B
            </button>
            <button
              aria-expanded={configOpen}
              aria-label="Configurações da entrada"
              className={`inline-flex items-center justify-center rounded-2xl border px-2 py-3 transition sm:px-3 ${
                configOpen || hasCustomConfig
                  ? "border-[rgba(216,31,89,0.48)] bg-[rgba(216,31,89,0.16)] text-white"
                  : "border-white/10 bg-white/4 text-[var(--text-dim)] hover:border-white/20 hover:text-white"
              }`}
              onClick={onToggleConfig}
              title="Configurações"
              type="button"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </div>
        )}
      </div>

      {isLay ? (
        <div className="min-w-0 space-y-2 text-sm">
          <span className="block text-[var(--text-muted)]">Odd Lay</span>
          <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:grid-cols-[minmax(0,1fr)_48px_48px]">
            <input
              className="lz-input min-w-0 w-full rounded-2xl px-3 py-3"
              inputMode="decimal"
              name={oddName}
              onChange={(event) => {
                const nextValue = event.target.value;

                onLayOddChange(nextValue);

                if (!oddValue.trim()) {
                  onOddChange(nextValue);
                }
              }}
              placeholder="0.000"
              value={displayedOddValue}
            />
            <button
              aria-label="Alternar para back"
              className="lz-button-primary rounded-2xl px-2 py-3 text-sm font-bold transition sm:px-3"
              onClick={onToggleSide}
              title="Lay"
              type="button"
            >
              L
            </button>
          <button
            aria-expanded={configOpen}
            aria-label="Configurações da entrada"
            className={`inline-flex items-center justify-center rounded-2xl border px-2 py-3 transition sm:px-3 ${
              configOpen || hasCustomConfig
                ? "border-[rgba(216,31,89,0.48)] bg-[rgba(216,31,89,0.16)] text-white"
                : "border-white/10 bg-white/4 text-[var(--text-dim)] hover:border-white/20 hover:text-white"
            }`}
            onClick={onToggleConfig}
            title="Configurações"
            type="button"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>
      </div>
      ) : null}

      {configOpen ? (
        <div className="min-w-0 space-y-3 sm:col-span-2">
          <div className="grid min-w-0 items-stretch gap-3 sm:grid-cols-3">
          <label className={configFieldClass}>
            <span className="text-[var(--text-muted)]">Aumento (%)</span>
            <input
              className="lz-input w-full rounded-xl px-3 py-2 text-sm"
              inputMode="decimal"
              onChange={(event) => onIncreaseChange(event.target.value)}
              placeholder="0,00"
              value={increaseValue}
            />
          </label>

          <label className={configFieldClass}>
            <span className="text-[var(--text-muted)]">Comissão (%)</span>
            <input
              className="lz-input w-full rounded-xl px-3 py-2 text-sm"
              inputMode="decimal"
              onChange={(event) => onCommissionChange(event.target.value)}
              placeholder="0,00"
              value={commissionValue}
            />
          </label>

          <label className={configFieldClass}>
            <span className="text-[var(--text-muted)]">Cashback (%)</span>
            <input
              className="lz-input w-full rounded-xl px-3 py-2 text-sm"
              inputMode="decimal"
              onChange={(event) => onCashbackChange(event.target.value)}
              placeholder="0,00"
              value={cashbackValue}
            />
          </label>
          </div>

          <div className="flex flex-col gap-2 px-1">
          <label
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]"
            title="A casa só paga o cashback quando esta aposta perde: se ela ganhar, o resultado e o mesmo que seria sem cashback e o credito conta apenas nos cenarios das outras casas."
          >
            <input
              checked={cashbackLossOnlyChecked}
              className="lz-checkbox"
              onChange={(event) =>
                onCashbackLossOnlyChange(event.target.checked)
              }
              type="checkbox"
            />
            <span>Cashback só na derrota</span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              checked={freebetChecked}
              className="lz-checkbox"
              onChange={(event) => onFreebetChange(event.target.checked)}
              type="checkbox"
            />
            <span>Freebet</span>
          </label>
          </div>
        </div>
      ) : null}
    </>
  );
}
