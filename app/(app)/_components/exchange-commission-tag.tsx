import { formatCommissionPercent } from "@/lib/monitor-odds/exchange";

export function ExchangeCommissionTag({
  commission,
  rawOdd,
}: {
  commission: number;
  rawOdd?: number;
}) {
  if (!commission) {
    return null;
  }

  const label = formatCommissionPercent(commission);
  const title = rawOdd
    ? `Odd com comissão de ${label} descontada · original ${rawOdd.toFixed(3)}`
    : `Odd com comissão de ${label} descontada`;

  return (
    <span
      aria-label={title}
      className="shrink-0 rounded-full border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.12)] px-1.5 py-0.5 text-[10px] font-semibold text-amber-200"
      title={title}
    >
      -{label}
    </span>
  );
}
