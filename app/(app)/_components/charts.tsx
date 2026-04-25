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

  return (
    <div className="space-y-4">
      <div className="flex h-56 items-end gap-3">
        {data.map((item) => {
          const height = Math.max((Math.abs(item.value) / maxValue) * 100, 8);
          const barClass =
            item.value >= 0 ? "bg-neutral-950" : "bg-red-400";

          return (
            <div className="flex min-w-0 flex-1 flex-col justify-end gap-3" key={item.label}>
              <div className="flex h-44 items-end rounded-xl bg-neutral-100 px-2 py-3">
                <div
                  className={`w-full rounded-lg ${barClass}`}
                  style={{ height: `${height}%` }}
                />
              </div>

              <div className="space-y-1 text-center">
                <p className="truncate text-xs font-medium text-neutral-700">{item.label}</p>
                <p className="text-xs text-neutral-500">{formatValue(item.value)}</p>
                {item.detail ? (
                  <p className="text-[11px] text-neutral-400">{item.detail}</p>
                ) : null}
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
