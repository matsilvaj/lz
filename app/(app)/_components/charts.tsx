"use client";

import { EmptyState } from "./ui";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  label: string;
  value: number;
  detail?: string;
  fullLabel?: string;
};

type Formatter = (value: number) => string;

function defaultFormatter(value: number) {
  return String(value);
}

function getTooltipLabel(payload: { payload?: ChartPoint } | undefined, label: string) {
  return payload?.payload?.fullLabel || label;
}

function getChartMinWidth(pointsCount: number) {
  return Math.max(pointsCount * 28, 560);
}

const THEME = {
  accent: "var(--accent, #d81f59)",
  positive: "#10b981",
  negative: "#ef4444",
  grid: "rgba(255, 255, 255, 0.05)",
  text: "var(--text-secondary, #9ca3af)",
};

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

  return (
    <div className="lz-scrollbar-hidden overflow-x-auto pb-2">
      <div
        className="h-[240px] pt-2 sm:h-[280px] sm:pt-3 lg:h-[320px] lg:pt-4"
        style={{ width: `max(100%, ${getChartMinWidth(data.length)}px)` }}
      >
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 18 }}>
          <CartesianGrid stroke={THEME.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={11}
            interval={0}
            height={34}
            minTickGap={0}
            padding={{ left: 4, right: 4 }}
            stroke={THEME.text}
            tickLine={false}
            tickMargin={10}
            ticks={data.map((item) => item.label)}
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            stroke={THEME.text}
            tickFormatter={(value) => formatValue(value)}
            tickLine={false}
            tickMargin={12}
            width={80}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const val = payload[0].value as number;
                const isPositive = val >= 0;
                const tooltipLabel = getTooltipLabel(payload[0], String(label ?? ""));

                return (
                  <div className="rounded-xl border border-white/10 bg-[#0b0509]/95 p-3 shadow-2xl backdrop-blur-md">
                    <p className="mb-1 text-xs font-medium text-neutral-400">{tooltipLabel}</p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: isPositive ? THEME.positive : THEME.negative }}
                    >
                      {formatValue(val)}
                    </p>
                    {payload[0].payload.detail ? (
                      <p className="mt-1 text-[10px] text-neutral-500">
                        {payload[0].payload.detail}
                      </p>
                    ) : null}
                  </div>
                );
              }

              return null;
            }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey="value" maxBarSize={48} radius={[4, 4, 4, 4]}>
            {data.map((entry, index) => (
              <Cell
                fill={entry.value >= 0 ? THEME.positive : THEME.negative}
                key={`cell-${index}`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LineChart({
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
        description="Assim que os registros entrarem, o grafico vai aparecer aqui."
      />
    );
  }

  return (
    <div className="lz-scrollbar-hidden overflow-x-auto pb-2">
      <div
        className="h-[240px] pt-2 sm:h-[280px] sm:pt-3 lg:h-[320px] lg:pt-4"
        style={{ width: `max(100%, ${getChartMinWidth(data.length)}px)` }}
      >
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 18 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={THEME.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={THEME.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={11}
            interval={0}
            height={34}
            minTickGap={0}
            padding={{ left: 4, right: 4 }}
            stroke={THEME.text}
            tickLine={false}
            tickMargin={10}
            ticks={data.map((item) => item.label)}
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            stroke={THEME.text}
            tickFormatter={(value) => formatValue(value)}
            tickLine={false}
            tickMargin={12}
            width={80}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const tooltipLabel = getTooltipLabel(payload[0], String(label ?? ""));

                return (
                  <div className="rounded-xl border border-white/10 bg-[#0b0509]/95 p-3 shadow-2xl backdrop-blur-md">
                    <p className="mb-1 text-xs font-medium text-neutral-400">{tooltipLabel}</p>
                    <p className="text-sm font-bold text-white">
                      {formatValue(Number(payload[0].value ?? 0))}
                    </p>
                  </div>
                );
              }

              return null;
            }}
          />
          <Area
            activeDot={{ r: 6, fill: THEME.accent, stroke: "#fff", strokeWidth: 2 }}
            dataKey="value"
            fill="url(#colorValue)"
            fillOpacity={1}
            stroke={THEME.accent}
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
