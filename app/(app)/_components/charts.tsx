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
        description="Assim que os registros entrarem, os graficos vao aparecer aqui."
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
    <div className="space-y-4">
      <div
        className={`flex h-40 items-end gap-2 overflow-x-auto pb-1 ${
          data.length === 1 ? "justify-center" : "justify-start"
        }`}
      >
        {data.map((item) => {
          const ratio = (Math.abs(item.value) / maxValue) * 100;
          const height = item.value === 0 ? 0 : Math.max(ratio, 8);
          const barClass = item.value >= 0 ? "bg-neutral-950" : "bg-red-400";
          const hoverValue = formatValue(item.value);

          return (
            <div
              className="group flex shrink-0 flex-col justify-end gap-3"
              key={item.label}
              style={{ width: `${itemWidth}px` }}
              title={hoverValue}
            >
              <div className="relative flex h-[7.5rem] items-end rounded-xl bg-neutral-100 px-1.5 py-2">
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 opacity-0 shadow-sm transition group-hover:opacity-100">
                  {hoverValue}
                </div>
                <div
                  className={`w-full rounded-lg ${barClass}`}
                  style={{ height: `${height}%` }}
                />
              </div>

              <div className="text-center">
                <p className="truncate text-xs font-medium text-neutral-700">{item.label}</p>
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
        description="Essa area sera preenchida assim que houver movimentacao."
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
              <p className="truncate font-medium text-neutral-800">{item.label}</p>
              <p className="shrink-0 text-neutral-500">{formatValue(item.value)}</p>
            </div>

            <div className="h-2.5 rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-950"
                style={{ width: `${width}%` }}
              />
            </div>

            {item.detail ? (
              <p className="text-xs text-neutral-500">{item.detail}</p>
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
        description="Assim que os registros entrarem, o grafico vai aparecer aqui."
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <svg
          aria-hidden="true"
          className="h-40 w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = paddingY + plotHeight * ratio;
            return (
              <line
                key={ratio}
                stroke="#e5e5e5"
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
              stroke="#d4d4d4"
              strokeWidth="1"
              x1={paddingX}
              x2={chartWidth - paddingX}
              y1={zeroLineY}
              y2={zeroLineY}
            />
          ) : null}

          <polyline
            fill="none"
            points={points}
            stroke="#171717"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          {data.map((item, index) => {
            const x = paddingX + stepX * index;
            const y = paddingY + ((maxValue - item.value) / range) * plotHeight;

            return (
              <circle
                cx={x}
                cy={y}
                fill="#171717"
                key={item.label}
                r="4"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
