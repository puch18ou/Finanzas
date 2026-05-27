"use client";

/**
 * src/app/evolucion/page.tsx — Evolucion anual (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { buildRatesMap, formatAmount } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { cn } from "@/lib/utils/cn";

const MESES_LABEL = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default function EvolucionPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();

  const [anio, setAnio] = useLocalStorage<number>(
    "evolucion:anio",
    settings?.anioActual ?? today.getFullYear(),
  );

  const { movements } = useMovements({ anio });

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const monthlyData = useMemo(() => {
    if (!settings) return [];
    const result = [];
    for (let mes = 1; mes <= 12; mes++) {
      const summary = summarizeMonth({
        mes,
        anio,
        movements,
        rates,
        viewCurrency,
      });
      result.push({ mes, ...summary });
    }
    return result;
  }, [settings, anio, movements, rates, viewCurrency]);

  const yearTotals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const r of monthlyData) {
      ingresos += r.ingresos;
      gastos += r.gastos;
    }
    const ahorro = ingresos - gastos;
    const tasa = ingresos > 0 ? ahorro / ingresos : 0;
    return { ingresos, gastos, ahorro, tasa };
  }, [monthlyData]);

  const chartData = useMemo(() => {
    return monthlyData.map((r) => ({
      mes: MESES_LABEL[r.mes - 1],
      Ingresos: Math.round(r.ingresos * 100) / 100,
      Gastos: Math.round(r.gastos * 100) / 100,
      Ahorro: Math.round(r.ahorro * 100) / 100,
    }));
  }, [monthlyData]);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evolucion</h1>
          <p className="text-sm text-muted-foreground">
            Resumen mensual del anio seleccionado.
          </p>
        </div>
        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Resumen {anio}</CardTitle>
          <CardDescription>
            Totales anuales en {viewCurrency}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <YearTotal label="Ingresos" value={formatAmount(yearTotals.ingresos, viewCurrency)} intent="positive" />
          <YearTotal label="Gastos" value={formatAmount(yearTotals.gastos, viewCurrency)} intent="negative" />
          <YearTotal
            label="Ahorro"
            value={formatAmount(yearTotals.ahorro, viewCurrency)}
            intent={yearTotals.ahorro >= 0 ? "positive" : "negative"}
          />
          <YearTotal
            label="Tasa media"
            value={`${(yearTotals.tasa * 100).toFixed(0)}%`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes a mes</CardTitle>
          <CardDescription>Ingresos vs gastos en {viewCurrency}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip
                  formatter={(v: unknown) => formatAmount(Number(v) || 0, viewCurrency)}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Legend />
                <Bar dataKey="Ingresos" fill="var(--color-primary)" />
                <Bar dataKey="Gastos" fill="var(--color-destructive)" />
                <Bar dataKey="Ahorro" fill="var(--color-chart-3, #888)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Ahorro</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((r) => (
                <TableRow key={r.mes}>
                  <TableCell className="font-medium">{MESES_LABEL[r.mes - 1]}</TableCell>
                  <TableCell className="text-right tabular-nums text-primary">
                    {formatAmount(r.ingresos, viewCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {formatAmount(r.gastos, viewCurrency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      r.ahorro >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {formatAmount(r.ahorro, viewCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.ingresos > 0 ? `${(r.tasaAhorro * 100).toFixed(0)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function YearTotal({
  label,
  value,
  intent = "neutral",
}: {
  label: string;
  value: string;
  intent?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          intent === "positive" && "text-primary",
          intent === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
