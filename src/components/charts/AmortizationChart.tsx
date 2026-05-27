"use client";

/**
 * ============================================================================
 *  src/components/charts/AmortizationChart.tsx
 * ============================================================================
 *
 *  Grafico de areas apiladas que muestra la evolucion de la hipoteca:
 *    - Capital amortizado (lo que ya has pagado del prestamo)
 *    - Capital pendiente (lo que queda por pagar)
 *
 *  El eje X es el año (1, 2, ... N). Cada punto es el cierre del año.
 *  La suma de las dos series en cualquier punto siempre es el capital
 *  inicial.
 * ============================================================================
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatAmount } from "@/lib/domain/currency";
import type { AnnualSummaryRow } from "@/lib/domain/mortgage";

type Props = {
  data: AnnualSummaryRow[];
  capitalInicial: number;
  moneda: string;
};

function tooltipNumberFormatter(moneda: string) {
  return (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return formatAmount(n, moneda);
  };
}

export function AmortizationChart({ data, moneda }: Props) {
  // Anadimos el punto 0 (año cero) para que el grafico empiece en el origen
  const chartData = [
    {
      anio: 0,
      amortizado: 0,
      pendiente: data[0]?.capitalPendiente
        ? data[0].capitalPendiente + data[0].capitalAnio
        : 0,
    },
    ...data.map((row) => ({
      anio: row.anio,
      amortizado: row.capitalAmortizado,
      pendiente: row.capitalPendiente,
    })),
  ];

  const formatY = (v: number) =>
    v >= 1000
      ? formatAmount(v / 1000, moneda).replace(/[.,]00/, "") + "k"
      : formatAmount(v, moneda);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAmortizado" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="gradPendiente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="anio"
          fontSize={11}
          stroke="var(--color-muted-foreground)"
          label={{ value: "Anio", position: "insideBottom", offset: -2, fontSize: 11 }}
        />
        <YAxis
          fontSize={11}
          stroke="var(--color-muted-foreground)"
          tickFormatter={formatY}
          width={80}
        />
        <RTooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
          }}
          formatter={tooltipNumberFormatter(moneda)}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Area
          type="monotone"
          dataKey="amortizado"
          stackId="1"
          stroke="var(--color-chart-1)"
          fill="url(#gradAmortizado)"
          name="Capital amortizado"
        />
        <Area
          type="monotone"
          dataKey="pendiente"
          stackId="1"
          stroke="var(--color-chart-3)"
          fill="url(#gradPendiente)"
          name="Capital pendiente"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
