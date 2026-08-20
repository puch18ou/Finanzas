"use client";

/**
 * src/app/proyeccion/page.tsx — Proyeccion (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo, useState } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import { useGoals } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
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
  ReferenceLine,
} from "recharts";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { summarizePortfolio } from "@/lib/domain/investments";
import { summarizeMortgage } from "@/lib/domain/mortgage";

export default function ProyeccionPage() {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { balances } = useAccountBalances();
  const { investments } = useInvestments();
  const { mortgage } = useMortgage();
  const { debts } = useOtherDebts();
  const { goals } = useGoals();

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
        total += convert(balances.get(a.id) ?? 0, a.moneda, viewCurrency, rates);
      } catch {}
    }
    return total;
  }, [accounts, balances, rates, viewCurrency]);

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

  // Metas: importe objetivo (para los hitos del grafico) y fecha estimada de
  // cumplimiento a partir de lo ya ahorrado + el ahorro mensual medio.
  const goalsInfo = useMemo(() => {
    return goals.map((g) => {
      // Saldo efectivo: cuenta vinculada (si la hay) o el ya ahorrado guardado.
      let yaAhorrado = g.yaAhorrado;
      if (g.cuentaVinculadaId) {
        const acc = accounts.find((a) => a.id === g.cuentaVinculadaId);
        if (acc) {
          try {
            yaAhorrado = Math.max(
              0,
              convert(balances.get(acc.id) ?? 0, acc.moneda, g.moneda, rates),
            );
          } catch {}
        }
      }
      let objetivoView = 0;
      let yaView = 0;
      try {
        objetivoView = convert(g.importeObjetivo, g.moneda, viewCurrency, rates);
      } catch {}
      try {
        yaView = convert(yaAhorrado, g.moneda, viewCurrency, rates);
      } catch {}

      const obj =
        g.fechaObjetivo instanceof Date
          ? g.fechaObjetivo
          : new Date(g.fechaObjetivo);
      const restante = Math.max(0, objetivoView - yaView);

      let estado: "done" | "ontrack" | "late" | "norate" = "norate";
      let estimada: Date | null = null;
      let mesesRetraso = 0;
      if (restante <= 0) {
        estado = "done";
      } else if (ahorroMensualMedio > 0) {
        const meses = Math.ceil(restante / ahorroMensualMedio);
        estimada = new Date(today.getFullYear(), today.getMonth() + meses, 1);
        mesesRetraso =
          (estimada.getFullYear() - obj.getFullYear()) * 12 +
          (estimada.getMonth() - obj.getMonth());
        estado = mesesRetraso <= 0 ? "ontrack" : "late";
      }

      return {
        id: g.id,
        nombre: g.nombre,
        objetivoView,
        fechaObjetivo: obj,
        estado,
        estimada,
        mesesRetraso,
      };
    });
  }, [goals, accounts, balances, rates, viewCurrency, ahorroMensualMedio, today]);

  const fmtMesAnio = (d: Date) =>
    `${MESES_ES_CORTO[d.getMonth()] ?? ""} ${d.getFullYear()}`;

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
              {money(patrimonioInicial, viewCurrency)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Patrimonio neto actual</Label>
            <p className="text-lg font-semibold tabular-nums">
              {money(patrimonioNetoActual, viewCurrency)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ahorro mensual medio (12m)</Label>
            <p className="text-lg font-semibold tabular-nums">
              {money(ahorroMensualMedio, viewCurrency)}
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
                {money(patrimonioProyectado, viewCurrency)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Crecimiento esperado</p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {money(patrimonioProyectado - patrimonioNetoActual, viewCurrency)}
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
                  formatter={(v: unknown) => money(Number(v) || 0, viewCurrency)}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                />
                {goalsInfo.map((g) => (
                  <ReferenceLine
                    key={g.id}
                    y={g.objetivoView}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: g.nombre,
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                ))}
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

      <Card>
        <CardHeader>
          <CardTitle>Metas</CardTitle>
          <CardDescription>
            Fecha estimada de cumplimiento segun lo ya ahorrado y tu ahorro
            mensual medio ({money(ahorroMensualMedio, viewCurrency)}/mes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goalsInfo.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tienes metas definidas. Crealas en Metas.
            </p>
          ) : (
            <div className="space-y-2">
              {goalsInfo.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {money(g.objetivoView, viewCurrency)} · objetivo{" "}
                      {fmtMesAnio(g.fechaObjetivo)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {g.estado === "done" ? (
                      <Badge className="bg-primary">Ya alcanzada</Badge>
                    ) : g.estado === "norate" ? (
                      <Badge variant="secondary">Sin ritmo de ahorro</Badge>
                    ) : (
                      <>
                        <span className="text-muted-foreground tabular-nums">
                          estimado {g.estimada ? fmtMesAnio(g.estimada) : "—"}
                        </span>
                        {g.estado === "ontrack" ? (
                          <Badge className="bg-primary">A tiempo</Badge>
                        ) : (
                          <Badge variant="destructive">
                            +{g.mesesRetraso}{" "}
                            {g.mesesRetraso === 1 ? "mes" : "meses"}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
