import { EmptyState } from "./ui";

type ChartPoint = {
  label: string;
  value: number;
  detail?: string;
};

type Formatter = (value: number) => string;

function defaultFormatter(value: number) {
  return String(value);
}

export function VerticalBarChart({
  data,
  formatValue = defaultFormatter,
}: {
  data: ChartPoint[];
  formatValue?: Formatter;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem dados suficientes"
        description="Assim que os registros entrarem, os gráficos vao aparecer aqui."
      />
    );
  }

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  const itemWidth =
    data.length === 1
      ? 144
      : data.length <= 4
        ? 112
        : data.length <= 8
          ? 84
          : data.length <= 16
            ? 56
            : data.length <= 31
              ? 36
              : 28;

  return (
    <div className="space-y-5">
      <div
        className={`flex h-52 items-end gap-3 overflow-x-auto pb-2 ${
          data.length === 1 ? "justify-center" : "justify-start"
        }`}
      >
        {data.map((item) => {
          const ratio = (Math.abs(item.value) / maxValue) * 100;
          const height = item.value === 0 ? 0 : Math.max(ratio, 8);
          const barClass =
            item.value >= 0
              ? "bg-[linear-gradient(180deg,var(--accent-soft),var(--accent))]"
              : "bg-[linear-gradient(180deg,#ff9db4,var(--negative))]";
          const hoverValue = formatValue(item.value);

          return (
            <div
              className="group flex shrink-0 flex-col justify-end gap-3"
              key={item.label}
              style={{ width: `${itemWidth}px` }}
              title={hoverValue}
            >
              <div className="relative flex h-[9.5rem] items-end rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[rgba(11,5,9,0.92)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition group-hover:opacity-100">
                  {hoverValue}
                </div>
                <div
                  className={`w-full rounded-[18px] shadow-[0_14px_30px_rgba(216,31,89,0.24)] ${barClass}`}
                  style={{ height: `${height}%` }}
                />
              </div>

              <div className="text-center">
                <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
                  {item.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorizontalBarChart({
  data,
  formatValue = defaultFormatter,
}: {
  data: ChartPoint[];
  formatValue?: Formatter;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Nada para mostrar ainda"
        description="Essa area sera preenchida assim que houver movimentação."
      />
    );
  }

  const maxValue = Math.max(...data.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = Math.max((Math.abs(item.value) / maxValue) * 100, 4);

        return (
          <div className="space-y-1.5" key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate font-medium text-white">{item.label}</p>
              <p className="shrink-0 text-[var(--text-muted)]">{formatValue(item.value)}</p>
            </div>

            <div className="h-2.5 rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-soft))]"
                style={{ width: `${width}%` }}
              />
            </div>

            {item.detail ? (
              <p className="text-xs text-[var(--text-dim)]">{item.detail}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({
  data,
}: {
  data: ChartPoint[];
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem dados suficientes"
        description="Assim que os registros entrarem, o gráfico vai aparecer aqui."
      />
    );
  }

  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 28;
  const paddingY = 20;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const values = data.map((item) => item.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = maxValue - minValue || 1;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data
    .map((item, index) => {
      const x = paddingX + stepX * index;
      const y = paddingY + ((maxValue - item.value) / range) * plotHeight;
      return { ...item, x, y };
    })
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const zeroLineY =
    minValue < 0 && maxValue > 0
      ? paddingY + ((maxValue - 0) / range) * plotHeight
      : null;
  const areaPoints = `${paddingX},${chartHeight - paddingY} ${points} ${chartWidth - paddingX},${chartHeight - paddingY}`;

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <svg
          aria-hidden="true"
          className="h-48 w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <defs>
            <linearGradient id="lz-line-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,119,163,0.46)" />
              <stop offset="100%" stopColor="rgba(255,119,163,0)" />
            </linearGradient>
            <filter id="lz-line-glow">
              <feGaussianBlur result="blur" stdDeviation="4" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = paddingY + plotHeight * ratio;
            return (
              <line
                key={ratio}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
                strokeWidth="1"
                x1={paddingX}
                x2={chartWidth - paddingX}
                y1={y}
                y2={y}
              />
            );
          })}

          {zeroLineY !== null ? (
            <line
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1"
              x1={paddingX}
              x2={chartWidth - paddingX}
              y1={zeroLineY}
              y2={zeroLineY}
            />
          ) : null}

          <polygon fill="url(#lz-line-gradient)" points={areaPoints} />

          <polyline
            fill="none"
            filter="url(#lz-line-glow)"
            points={points}
            stroke="var(--accent-soft)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />

          {data.map((item, index) => {
            const x = paddingX + stepX * index;
            const y = paddingY + ((maxValue - item.value) / range) * plotHeight;

            return (
              <circle
                cx={x}
                cy={y}
                fill="#fff4f8"
                key={item.label}
                r="4.5"
              />
            );
          })}
        </svg>

        <div className="mt-4 flex flex-wrap gap-2">
          {data.map((item) => (
            <span
              className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-[11px] text-[var(--text-secondary)]"
              key={item.label}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
