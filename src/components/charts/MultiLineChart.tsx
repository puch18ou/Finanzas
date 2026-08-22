"use client";

/**
 * src/components/charts/MultiLineChart.tsx
 *
 * Grafico de lineas generico (N series) para las comparativas de Evolucion:
 *   - Comparar años: una linea por año sobre el eje Ene..Dic.
 *   - Por categoria: una linea por categoria a lo largo de los meses.
 *
 * Respeta el modo privacidad (enmascara eje Y y tooltip) igual que
 * EvolutionChart.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatAmount } from "@/lib/domain/currency";
import { usePrivacy } from "@/contexts/PrivacyProvider";
import { maskMoney } from "@/lib/utils/privacy";

export type LineSeries = { key: string; name: string; color: string };

/** Paleta por defecto (tokens del tema). Se cicla si hay mas series. */
export const CHART_PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
  "var(--color-destructive)",
];

type Props = {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: LineSeries[];
  viewCurrency: string;
  height?: number;
};

export function MultiLineChart({
  data,
  xKey,
  series,
  viewCurrency,
  height = 340,
}: Props) {
  const { hidden } = usePrivacy();

  const formatY = (v: number) => {
    if (hidden) return "••";
    return v >= 1000
      ? formatAmount(v / 1000, viewCurrency).replace(/[.,]00/, "") + "k"
      : formatAmount(v, viewCurrency);
  };

  const tooltipFormatter = (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    const s = formatAmount(n, viewCurrency);
    return hidden ? maskMoney(s) : s;
  };

  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Elige al menos una serie para ver la grafica.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey={xKey}
          fontSize={11}
          stroke="var(--color-muted-foreground)"
        />
        <YAxis
          fontSize={11}
          stroke="var(--color-muted-foreground)"
          tickFormatter={formatY}
          width={70}
        />
        <RTooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
          }}
          formatter={tooltipFormatter}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            name={s.name}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
