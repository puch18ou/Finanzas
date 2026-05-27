"use client";

/**
 * src/app/proyeccion/page.tsx — Proyeccion (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo, useState } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useAccounts } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { summarizePortfolio } from "@/lib/domain/investments";
import { summarizeMortgage } from "@/lib/domain/mortgage";

export default function ProyeccionPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { investments } = useInvestments();
  const { mortgage } = useMortgage();
  const { debts } = useOtherDebts();

  const currentYear = today.getFullYear();

  const { movements: movsThisYear } = useMovements({ anio: currentYear });
  const { movements: movsPrevYear } = useMovements({ anio: currentYear - 1 });

  const [horizonMonths, setHorizonMonths] = useState(60);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const allMovements = useMemo(
    () => [...movsThisYear, ...movsPrevYear],
    [movsThisYear, movsPrevYear],
  );

  const ahorroMensualMedio = useMemo(() => {
    if (!settings) return 0;
    const mesesConDatos: number[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, today.getMonth() - i, 1);
      const mes = d.getMonth() + 1;
      const anio = d.getFullYear();

      const summary = summarizeMonth({
        mes,
        anio,
        movements: allMovements,
        rates,
        viewCurrency,
      });

      if (summary.ingresos > 0 || summary.gastos > 0) {
        mesesConDatos.push(summary.ahorro);
      }
    }

    if (mesesConDatos.length === 0) return 0;
    return mesesConDatos.reduce((a, b) => a + b, 0) / mesesConDatos.length;
  }, [settings, allMovements, rates, viewCurrency, currentYear, today]);

  const valorCuentas = useMemo(() => {
    let total = 0;
    for (const a of accounts) {
      if (!a.activa) continue;
      try {
        total += convert(a.saldo, a.moneda, viewCurrency, rates);
      } catch {}
    }
    return total;
  }, [accounts, rates, viewCurrency]);

  const portfolio = useMemo(
    () => summarizePortfolio(investments, rates, viewCurrency),
    [investments, rates, viewCurrency],
  );

  const mortgageSummary = useMemo(() => {
    if (!mortgage) return null;
    return summarizeMortgage({
      precioVivienda: mortgage.precioVivienda,
      entrada: mortgage.entrada,
      gastosAsociados: mortgage.gastosAsociados,
      plazoAnios: mortgage.plazoAnios,
      tin: mortgage.tin,
    });
  }, [mortgage]);

  const deudaTotal = useMemo(() => {
    let total = 0;
    if (mortgage?.activa && mortgageSummary) {
      try {
        total += convert(
          mortgageSummary.capitalPrestado,
          mortgage.moneda,
          viewCurrency,
          rates,
        );
      } catch {}
    }
    for (const d of debts) {
      try {
        total += convert(d.capitalPendiente, d.moneda, viewCurrency, rates);
      } catch {}
    }
    return total;
  }, [mortgage, mortgageSummary, debts, rates, viewCurrency]);

  const patrimonioInicial = useMemo(() => {
    if (!settings) return 0;
    try {
      return convert(
        settings.patrimonioInicial,
        settings.patrimonioInicialMoneda ?? viewCurrency,
        viewCurrency,
        rates,
      );
    } catch {
      return 0;
    }
  }, [settings, rates, viewCurrency]);

  const patrimonioNetoActual =
    valorCuentas + portfolio.valorActualVista - deudaTotal;

  const projectionData = useMemo(() => {
    const data: { mes: number; patrimonio: number; label: string }[] = [];
    let current = patrimonioNetoActual;
    for (let i = 0; i <= horizonMonths; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      data.push({
        mes: i,
        patrimonio: Math.round(current * 100) / 100,
        label: `${d.getMonth() + 1}/${d.getFullYear()}`,
      });
      current += ahorroMensualMedio;
    }
    return data;
  }, [patrimonioNetoActual, ahorroMensualMedio, horizonMonths, today]);

  const patrimonioProyectado = projectionData[projectionData.length - 1]?.patrimonio ?? 0;

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Proyeccion</h1>
        <p className="text-sm text-muted-foreground">
          Evolucion estimada del patrimonio segun tu tasa de ahorro media.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parametros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Patrimonio inicial declarado</Label>
            <p className="text-lg font-semibold tabular-nums">
              {formatAmount(patrimonioInicial, viewCurrency)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Patrimonio neto actual</Label>
            <p className="text-lg font-semibold tabular-nums">
              {formatAmount(patrimonioNetoActual, viewCurrency)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ahorro mensual medio (12m)</Label>
            <p className="text-lg font-semibold tabular-nums">
              {formatAmount(ahorroMensualMedio, viewCurrency)}
            </p>
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="horizon">Horizonte (meses)</Label>
            <Input
              id="horizon"
              type="number"
              min={1}
              max={600}
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Math.max(1, Number(e.target.value) || 1))}
              className="max-w-[160px]"
            />
            <p className="text-xs text-muted-foreground">
              Aprox. {(horizonMonths / 12).toFixed(1)} anios
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proyeccion</CardTitle>
          <CardDescription>
            Estimacion lineal sin tener en cuenta inflacion, rendimiento de inversiones, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">En {horizonMonths} meses</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatAmount(patrimonioProyectado, viewCurrency)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Crecimiento esperado</p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {formatAmount(patrimonioProyectado - patrimonioNetoActual, viewCurrency)}
              </p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" interval="preserveStartEnd" />
                <YAxis />
                <Tooltip
                  formatter={(v: unknown) => formatAmount(Number(v) || 0, viewCurrency)}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="patrimonio"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
