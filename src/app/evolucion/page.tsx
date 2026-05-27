"use client";

/**
 * ============================================================================
 *  src/app/evolucion/page.tsx
 * ============================================================================
 *
 *  Tabla anual y grafico de evolucion mensual.
 *
 *  Contenido:
 *    [Selector de año]
 *    [Grafico configurable: lineas / barras / areas]
 *    [Tabla 12 meses: ingresos, gastos, ahorro, tasa, cumple objetivo]
 *    [Fila de total/promedio anual]
 *
 *  Todo en moneda vista.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useExpenses } from "@/hooks/useExpenses";
import { useMonthlyIncomes } from "@/hooks/useMonthlyIncomes";
import { useExtraIncomes } from "@/hooks/useExtraIncomes";
import { EvolutionChart } from "@/components/charts/EvolutionChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { buildRatesMap, formatAmount } from "@/lib/domain/currency";
import { summarizeYear } from "@/lib/domain/aggregation";
import { MESES_ES } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export default function EvolucionPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();

  const [anio, setAnio] = useState<number>(
    settings?.anioActual ?? new Date().getFullYear(),
  );

  // Para evolucion necesitamos TODO el año
  const { expenses } = useExpenses({ anio });
  const { rows: monthlyIncomes } = useMonthlyIncomes(
    anio,
    settings?.monedaLocal ?? "EUR",
  );
  const { extras } = useExtraIncomes({ anio });

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const yearSummary = useMemo(() => {
    if (!settings) return null;
    return summarizeYear({
      anio,
      expenses,
      monthlyIncomes,
      extraIncomes: extras,
      rates,
      viewCurrency,
    });
  }, [settings, anio, expenses, monthlyIncomes, extras, rates, viewCurrency]);

  const totalAnual = useMemo(() => {
    if (!yearSummary) return null;
    const ingresos = yearSummary.reduce((s, m) => s + m.ingresos, 0);
    const gastos = yearSummary.reduce((s, m) => s + m.gastos, 0);
    const ahorro = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;
    return { ingresos, gastos, ahorro, tasaAhorro };
  }, [yearSummary]);

  if (!settings || !yearSummary || !totalAnual) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const objetivo = settings.objetivoAhorroPct;
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);

  // Datos para el grafico (renombrando campos)
  const chartData = yearSummary.map((m) => ({
    mes: m.mes,
    ingresos: m.ingresos,
    gastos: m.gastos,
    ahorro: m.ahorro,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evolucion</h1>
          <p className="text-sm text-muted-foreground">
            Tabla mensual con ingresos, gastos, ahorro y tasa de ahorro a lo
            largo del anio.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="anio-evol" className="text-xs">Anio</Label>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger id="anio-evol" className="w-[120px]">
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
        </div>
      </header>

      <EvolutionChart
        data={chartData}
        viewCurrency={viewCurrency}
        title={`Evolucion mensual ${anio}`}
        description={`Valores convertidos a ${viewCurrency}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumen mensual</CardTitle>
          <CardDescription>
            Objetivo de ahorro: {(objetivo * 100).toFixed(0)}%. Los meses que
            lo cumplen aparecen con un check verde.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Ahorro</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
                <TableHead className="text-center w-[60px]">Objetivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearSummary.map((m) => {
                const cumple = m.ingresos > 0 && m.tasaAhorro >= objetivo;
                const ningunDato = m.ingresos === 0 && m.gastos === 0;
                return (
                  <TableRow
                    key={m.mes}
                    className={ningunDato ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">
                      {MESES_ES[m.mes - 1]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(m.ingresos, viewCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(m.gastos, viewCurrency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        m.ahorro < 0 && "text-destructive",
                        m.ahorro > 0 && "text-primary",
                      )}
                    >
                      {formatAmount(m.ahorro, viewCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.ingresos > 0
                        ? `${(m.tasaAhorro * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {ningunDato ? (
                        <span className="text-muted-foreground">—</span>
                      ) : cumple ? (
                        <Check className="mx-auto h-4 w-4 text-primary" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total {anio}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatAmount(totalAnual.ingresos, viewCurrency)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatAmount(totalAnual.gastos, viewCurrency)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    totalAnual.ahorro < 0 && "text-destructive",
                    totalAnual.ahorro > 0 && "text-primary",
                  )}
                >
                  {formatAmount(totalAnual.ahorro, viewCurrency)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totalAnual.ingresos > 0
                    ? `${(totalAnual.tasaAhorro * 100).toFixed(0)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {totalAnual.ingresos > 0 &&
                  totalAnual.tasaAhorro >= objetivo ? (
                    <Check className="mx-auto h-4 w-4 text-primary" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-destructive" />
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
