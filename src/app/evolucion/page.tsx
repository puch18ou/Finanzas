"use client";

/**
 * src/app/evolucion/page.tsx — Evolucion anual (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { monthlyOccurrenceFor } from "@/lib/domain/recurring";
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
import { EvolutionChart } from "@/components/charts/EvolutionChart";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
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
  const { data: activeRules = [] } = useActiveRecurringRules();

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Previstos del mes ACTUAL real (no en meses futuros, donde no tiene
  // sentido contar como movimiento del mes algo aun por venir). Devuelve
  // ingresos y gastos previstos del mes actual del anio seleccionado.
  const previstosMesActual = useMemo(() => {
    const zero = { mes: 0, ingresos: 0, gastos: 0 };
    if (!settings) return zero;
    const now = new Date();
    if (anio !== now.getFullYear()) return zero;
    const currentMes = now.getMonth() + 1;
    const nowMs = now.getTime();
    let ingresos = 0;
    let gastos = 0;
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      const esIngreso =
        rule.tipoMovimiento === "ingreso" ||
        rule.tipoMovimiento === "intereses";
      const esGasto =
        rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
      if (!esIngreso && !esGasto) continue;
      const occ = monthlyOccurrenceFor(rule, anio, currentMes);
      if (!occ) continue;
      if (occ.getTime() <= nowMs) continue;
      try {
        const importe = convert(rule.importe, rule.moneda, viewCurrency, rates);
        if (esIngreso) ingresos += importe;
        else gastos += importe;
      } catch {
        // ignorar moneda no encontrada
      }
    }
    return { mes: currentMes, ingresos, gastos };
  }, [settings, anio, activeRules, rates, viewCurrency]);

  const monthlyData = useMemo(() => {
    if (!settings) return [];
    const result = [];
    for (let mes = 1; mes <= 12; mes++) {
      const base = summarizeMonth({
        mes,
        anio,
        movements,
        rates,
        viewCurrency,
      });
      const isCurrent = mes === previstosMesActual.mes;
      const ingresoPrevisto = isCurrent ? previstosMesActual.ingresos : 0;
      const gastoPrevisto = isCurrent ? previstosMesActual.gastos : 0;
      const ingresos = base.ingresos + ingresoPrevisto;
      const gastos = base.gastos + gastoPrevisto;
      const ahorro = ingresos - gastos;
      const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;
      result.push({
        mes,
        ...base,
        ingresos,
        gastos,
        ahorro,
        tasaAhorro,
        ingresoPrevisto,
        gastoPrevisto,
      });
    }
    return result;
  }, [settings, anio, movements, rates, viewCurrency, previstosMesActual]);

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

      <EvolutionChart
        data={monthlyData}
        viewCurrency={viewCurrency}
        title="Mes a mes"
        description={`Ingresos vs gastos en ${viewCurrency}`}
      />

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
                    {r.ingresoPrevisto > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        +{formatAmount(r.ingresoPrevisto, viewCurrency)} previsto
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {formatAmount(r.gastos, viewCurrency)}
                    {r.gastoPrevisto > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        +{formatAmount(r.gastoPrevisto, viewCurrency)} previsto
                      </div>
                    )}
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
