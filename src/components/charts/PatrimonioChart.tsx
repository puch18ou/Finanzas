"use client";

/**
 * ============================================================================
 *  src/components/charts/PatrimonioChart.tsx
 * ============================================================================
 *
 *  Evolucion REAL del patrimonio a partir de las fotos diarias
 *  (patrimonio_snapshots). Area del patrimonio neto + lineas de cuentas e
 *  inversiones. Valores en la moneda en que se guardaron (la local).
 *
 *  Si aun no hay suficientes fotos, muestra un aviso: el historico se va
 *  construyendo (una foto al dia al abrir la app).
 * ============================================================================
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatAmount } from "@/lib/domain/currency";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import type { PatrimonioSnapshot } from "@/lib/db/schema";

type Props = {
  snapshots: PatrimonioSnapshot[];
};

/** Etiqueta corta del eje X a partir de la fecha civil (mediodia UTC). */
function shortLabel(fecha: Date): string {
  const d = fecha.getUTCDate();
  const m = MESES_ES_CORTO[fecha.getUTCMonth()] ?? "";
  return `${d} ${m}`;
}

function tooltipNumberFormatter(moneda: string) {
  return (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return formatAmount(n, moneda);
  };
}

/** Eje Y compacto: 12.500 -> "12,5k". */
function formatYAxis(v: number, moneda: string): string {
  if (Math.abs(v) >= 1000) {
    return (
      formatAmount(v / 1000, moneda, { decimals: 1 }).replace(/[.,]0(?=\D|$)/, "") +
      "k"
    );
  }
  return formatAmount(v, moneda, { decimals: 0 });
}

export function PatrimonioChart({ snapshots }: Props) {
  const moneda = snapshots[snapshots.length - 1]?.moneda ?? "EUR";

  const data = useMemo(
    () =>
      snapshots.map((s) => ({
        label: shortLabel(s.fecha),
        patrimonio: s.patrimonioNeto,
        cuentas: s.valorCuentas,
        inversiones: s.valorInversiones,
        deuda: s.deudaTotal,
      })),
    [snapshots],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patrimonio</CardTitle>
        <CardDescription>
          Evolucion real del patrimonio neto en {moneda}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aun no hay suficiente historico. Se guarda una foto del patrimonio
            al dia (al abrir la app); en unos dias veras aqui su evolucion.
          </p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  width={70}
                  tickFormatter={(v) => formatYAxis(Number(v), moneda)}
                />
                <RTooltip
                  formatter={tooltipNumberFormatter(moneda)}
                  labelClassName="text-xs"
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="patrimonio"
                  name="Patrimonio neto"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#gradPatrimonio)"
                />
                <Line
                  type="monotone"
                  dataKey="cuentas"
                  name="Cuentas"
                  stroke="var(--color-chart-2)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="inversiones"
                  name="Inversiones"
                  stroke="var(--color-chart-4)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
