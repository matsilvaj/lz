"use client";

// Escolha do lucro alvo de uma casa, igual na calculadora e no procedimento:
// nada marcado = lucro normal; "Zerar lucro" ou "Definir Lucro" quando marcado.

export type ProfitTargetMode = "normal" | "zerar" | "valor";
export type ProfitTargetUnit = "R$" | "%";

export type ProfitTargetValue = {
  mode: ProfitTargetMode;
  unit: ProfitTargetUnit;
  value: string;
};

export const PROFIT_TARGET_DEFAULT: ProfitTargetValue = {
  mode: "normal",
  unit: "R$",
  value: "",
};

const OPTIONS: Array<{ label: string; mode: Exclude<ProfitTargetMode, "normal"> }> = [
  { label: "Zerar lucro", mode: "zerar" },
  { label: "Definir Lucro", mode: "valor" },
];

export function ProfitTargetOptions({
  name,
  onChange,
  target,
}: {
  // Prefixo dos campos, para não repetir nome entre casas.
  name: string;
  onChange: (patch: Partial<ProfitTargetValue>) => void;
  target: ProfitTargetValue;
}) {
  return (
    <div className="space-y-1.5">
      {OPTIONS.map((option) => {
        const selected = target.mode === option.mode;

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
                name={`${name}-${option.mode}`}
                // Marcar troca o alvo; desmarcar volta para o lucro normal.
                onChange={() =>
                  onChange({ mode: selected ? "normal" : option.mode })
                }
                type="checkbox"
              />
              <span className="text-[var(--text-secondary)]">{option.label}</span>
            </label>

            {selected && option.mode === "valor" ? (
              <div className="mt-2.5 flex gap-2">
                <input
                  className="lz-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white"
                  onChange={(event) => onChange({ value: event.target.value })}
                  placeholder={target.unit === "%" ? "50" : "0,00"}
                  step="0.01"
                  type="number"
                  value={target.value}
                />
                <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/4 p-0.5">
                  {(["R$", "%"] as const).map((unit) => (
                    <button
                      className={`rounded-lg px-2.5 text-xs font-semibold transition ${
                        target.unit === unit
                          ? "lz-button-primary"
                          : "text-[var(--text-dim)] hover:text-white"
                      }`}
                      key={unit}
                      onClick={() => onChange({ unit })}
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
  );
}

// Formato aceito por calculateSurebet.
export function toProfitTargetInput(target: ProfitTargetValue | undefined) {
  if (!target || target.mode === "normal") {
    return { modo: "normal", valor: 0 };
  }

  if (target.mode === "zerar") {
    return { modo: "zerar", valor: 0 };
  }

  const value = Number.parseFloat(String(target.value).replace(",", "."));
  const safeValue = Number.isFinite(value) ? value : 0;

  return target.unit === "%"
    ? { modo: "percentual", valor: safeValue }
    : { modo: "valor", valor: safeValue };
}
