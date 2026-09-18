import { Flame } from "lucide-react";

export function TrendingBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[rgba(251,146,60,0.35)] bg-[rgba(251,146,60,0.12)] px-2.5 py-1 text-[11px] font-semibold text-orange-300"
      title="Entre os 10 jogos mais acessados nas últimas 24h"
    >
      <Flame aria-hidden="true" className="h-3.5 w-3.5" />
      Em alta
    </span>
  );
}
