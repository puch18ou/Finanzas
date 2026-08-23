"use client";

/**
 * src/components/evolucion/CompareYearsTab.tsx
 *
 * Pestaña "Comparar años" de Evolucion (PC). Superpone, mes a mes (Ene..Dic),
 * una linea por año de la metrica elegida (gastos/ingresos/ahorro) y muestra
 * ademas una tabla con la variacion % entre los dos años mas recientes.
 */

import { useMemo, useState } from "react";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import {
  compareYearsByMonth,
  previstosDelMes,
  totalsByYear,
  type MetricKey,
} from "@/lib/domain/aggregation";
import type { RatesMap } from "@/lib/domain/currency";
import { formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MultiLineChart, CHART_PALETTE } from "@/components/charts/MultiLineChart";
import { cn } from "@/lib/utils/cn";

const METRIC_LABEL: Record<MetricKey, string> = {
  gastos: "Gastos",
  ingresos: "Ingresos",
  ahorro: "Ahorro",
};

type Props = {
  viewCurrency: string;
  rates: RatesMap;
  incluirPrevistos: boolean;
};

export function CompareYearsTab({ viewCurrency, rates, incluirPrevistos }: Props) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const [selectedYears, setSelectedYears] = useState<number[]>([
    currentYear,
    currentYear - 1,
  ]);
  const [metric, setMetric] = useState<MetricKey>("gastos");

  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));

  // Años ordenados de mayor a menor para la leyenda/tabla; colores por indice.
  const years = useMemo(
    () => [...selectedYears].sort((a, b) => b - a),
    [selectedYears],
  );

  const anioDesde = years.length ? Math.min(...years) : currentYear;
  const anioHasta = years.length ? Math.max(...years) : currentYear;
  const { movements } = useMovements({ anioDesde, anioHasta });

  const { data: activeRules = [] } = useActiveRecurringRules();

  const rawRows = useMemo(
    () => compareYearsByMonth(movements, years, metric, rates, viewCurrency),
    [movements, years, metric, rates, viewCurrency],
  );

  // Sumamos los PREVISTOS del mes actual (recurrentes aun no generados) a la
  // celda del año en curso, igual que la pestaña General.
  const rows = useMemo(() => {
    if (!incluirPrevistos) return rawRows;
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    if (!years.includes(cy)) return rawRows;
    const prev = previstosDelMes(activeRules, cy, cm, now, rates, viewCurrency);
    const add =
      metric === "gastos"
        ? prev.gastos
        : metric === "ingresos"
          ? prev.ingresos
          : prev.ingresos - prev.gastos;
    if (add === 0) return rawRows;
    return rawRows.map((r) =>
      r.mes === cm
        ? { ...r, values: { ...r.values, [cy]: (r.values[cy] ?? 0) + add } }
        : r,
    );
  }, [rawRows, activeRules, years, metric, rates, viewCurrency, incluirPrevistos]);

  const totals = useMemo(() => totalsByYear(rows, years), [rows, years]);

  // Datos para el grafico: { mesLabel, [year]: valor }.
  const chartData = useMemo(
    () =>
      rows.map((r) => {
        const row: Record<string, number | string> = {
          mesLabel: MESES_ES_CORTO[r.mes - 1] ?? String(r.mes),
        };
        for (const y of years) row[String(y)] = r.values[y] ?? 0;
        return row;
      }),
    [rows, years],
  );

  const series = useMemo(
    () =>
      years.map((y, i) => ({
        key: String(y),
        name: String(y),
        color: CHART_PALETTE[i % CHART_PALETTE.length]!,
      })),
    [years],
  );

  // Los dos años mas recientes seleccionados, para la columna de variacion %.
  const [recentYear, prevYear] =
    years.length >= 2 ? [years[0]!, years[1]!] : [null, null];

  const pct = (recent: number, prev: number): number | null => {
    if (prev === 0) return null;
    return ((recent - prev) / Math.abs(prev)) * 100;
  };

  function toggleYear(y: number) {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y],
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Comparar años</CardTitle>
            <CardDescription>
              {METRIC_LABEL[metric]} mes a mes, un año por linea (en {viewCurrency}).
            </CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => v && setMetric(v as MetricKey)}>
            <SelectTrigger className="w-[140px]" data-tour="evo-comparar-metrica">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gastos">Gastos</SelectItem>
              <SelectItem value="ingresos">Ingresos</SelectItem>
              <SelectItem value="ahorro">Ahorro</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" data-tour="evo-comparar-anios">
            {yearOptions.map((y) => {
              const active = selectedYears.includes(y);
              return (
                <Button
                  key={y}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleYear(y)}
                >
                  {y}
                </Button>
              );
            })}
          </div>

          {years.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecciona al menos un año.
            </p>
          ) : (
            <MultiLineChart
              data={chartData}
              xKey="mesLabel"
              series={series}
              viewCurrency={viewCurrency}
            />
          )}
        </CardContent>
      </Card>

      {years.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle mes a mes</CardTitle>
            <CardDescription>
              {recentYear && prevYear
                ? `Variacion % de ${recentYear} respecto a ${prevYear}.`
                : "Selecciona dos años o mas para ver la variacion %."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">Mes</TableHead>
                    {years.map((y) => (
                      <TableHead key={y} className="text-right">
                        {y}
                      </TableHead>
                    ))}
                    {recentYear && prevYear && (
                      <TableHead className="text-right">Δ%</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const variacion =
                      recentYear && prevYear
                        ? pct(r.values[recentYear] ?? 0, r.values[prevYear] ?? 0)
                        : null;
                    return (
                      <TableRow key={r.mes}>
                        <TableCell className="font-medium">
                          {MESES_ES_CORTO[r.mes - 1]}
                        </TableCell>
                        {years.map((y) => (
                          <TableCell key={y} className="text-right tabular-nums">
                            {money(r.values[y] ?? 0)}
                          </TableCell>
                        ))}
                        {recentYear && prevYear && (
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              variacion == null
                                ? "text-muted-foreground"
                                : variacion > 0
                                  ? "text-destructive"
                                  : "text-primary",
                            )}
                          >
                            {variacion == null
                              ? "—"
                              : `${variacion > 0 ? "+" : ""}${variacion.toFixed(0)}%`}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    {years.map((y) => (
                      <TableCell key={y} className="text-right tabular-nums font-medium">
                        {money(totals[y] ?? 0)}
                      </TableCell>
                    ))}
                    {recentYear && prevYear && (
                      <TableCell className="text-right tabular-nums font-medium">
                        {(() => {
                          const v = pct(
                            totals[recentYear] ?? 0,
                            totals[prevYear] ?? 0,
                          );
                          return v == null
                            ? "—"
                            : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
                        })()}
                      </TableCell>
                    )}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
