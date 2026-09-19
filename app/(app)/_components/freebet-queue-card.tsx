"use client";

import { PartnerInlineName } from "./partner-picker";
import { formatCurrency, formatNumber, getProfitClass } from "./ui";

// Cartão das filas no celular e no tablet, no mesmo padrão dos cartões de Procedimentos.
export function FreebetQueueCard({
  actionLabel,
  date,
  dateLabel,
  event,
  house,
  onAction,
  partnerName,
  quantity,
  result,
  value,
}: {
  actionLabel: string;
  date: string;
  dateLabel: string;
  event?: string;
  house: string;
  onAction: () => void;
  partnerName?: string;
  quantity?: number;
  result?: number;
  value: number;
}) {
  return (
    <article
      className="cursor-pointer rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/8"
      onClick={onAction}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--accent-soft)]">{dateLabel}</span> {date}
          </p>
          {event ? <p className="truncate text-sm font-medium text-white">{event}</p> : null}
          <p className="text-sm font-semibold text-white">
            {house}
            <PartnerInlineName name={partnerName} />
            {quantity && quantity > 1 ? (
              <span className="ml-1.5 text-xs font-medium text-[var(--text-dim)]">
                ×{formatNumber(quantity)}
              </span>
            ) : null}
          </p>
        </div>
        <button
          className="lz-button-primary shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onAction();
          }}
          type="button"
        >
          {actionLabel}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-dim)]">Valor FB</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-semibold text-white">
            {formatCurrency(value)}
          </p>
        </div>
        {result === undefined ? null : (
          <div className="min-w-0 text-right">
            <p className="text-xs text-[var(--text-dim)]">Resultado coleta</p>
            <p className={`mt-0.5 whitespace-nowrap text-sm font-semibold ${getProfitClass(result)}`}>
              {formatCurrency(result)}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
