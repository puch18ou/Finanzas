"use client";

/**
 * src/app/dashboard/page.tsx — Dashboard (Lote 10a-3)
 *
 * Eliminada la dependencia de monthly_incomes. Los ingresos vienen solo
 * de movements tipo ingreso/intereses. Hasta el Lote 11, el salario no
 * se cuenta automaticamente — el usuario tendra que meterlo a mano
 * como movement tipo "ingreso" si quiere verlo en el Dashboard.
 */

import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Coins,
  PieChart as PieIcon,
} from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { useMovements } from "@/hooks/useMovements";
import { useInvestments } from "@/hooks/useInvestments";
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { useObjetivoTramos } from "@/hooks/useObjetivoTramos";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { occurrencesForRule } from "@/lib/domain/recurring";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { CashflowCard } from "@/components/dashboard/CashflowCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import {
  summarizeMonth,
  sumMovementsByCategory,
  filterMovementsByPeriod,
} from "@/lib/domain/aggregation";
import { summarizePortfolio } from "@/lib/domain/investments";
import { summarizeMortgage } from "@/lib/domain/mortgage";
import { MESES_ES, periodKey } from "@/lib/utils/dates";
import { resolveTramo, tramosAncla, resolvePresupuesto } from "@/lib/domain/tramos";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { cn } from "@/lib/utils/cn";

export default function DashboardPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { balances } = useAccountBalances();
  const { investments } = useInvestments();
  const { mortgage } = useMortgage();
  const { debts } = useOtherDebts();

  const today = new Date();
  // Arrancamos SIEMPRE en el mes real actual (no lo persistimos en
  // localStorage: el usuario quiere ver el mes en curso cada vez que abre la
  // app, no el ultimo que dejo seleccionado). El selector de periodo sigue
  // permitiendo navegar a otros meses durante la sesion.
  const [periodAnio, setPeriodAnio] = useState<number>(today.getFullYear());
  const [periodMes, setPeriodMes] = useState<number>(today.getMonth() + 1);

  const { movements } = useMovements({ anio: periodAnio, mes: periodMes });
  // Año completo, para el acumulado de ahorro desde la fecha del objetivo.
  const { movements: movementsAnio } = useMovements({ anio: periodAnio });
  const { data: activeRules = [] } = useActiveRecurringRules();
  const { tramos: objetivoTramos } = useObjetivoTramos();
  const { tramos: presupuestoTramos } = usePresupuestoTramos();

  const categoryById = useMemo(() => {
    const m: Record<string, { nombre: string; color: string | null }> = {};
    for (const c of categories) m[c.id] = { nombre: c.nombre, color: c.color };
    return m;
  }, [categories]);

  const categoryNamesMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.nombre;
    return m;
  }, [categories]);

  const accountNamesMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.alias;
    return m;
  }, [accounts]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";
  // Enmascara importes en moneda vista si el modo privacidad esta activo.
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));

  const baseSummary = useMemo(() => {
    if (!settings) return null;
    return summarizeMonth({
      mes: periodMes,
      anio: periodAnio,
      movements,
      rates,
      viewCurrency,
    });
  }, [settings, periodMes, periodAnio, movements, rates, viewCurrency]);

  // Previstos del periodo: solo se anaden si el periodo seleccionado
  // COINCIDE con el mes/anio actual del sistema (no en periodos futuros,
  // donde no tiene sentido contar como movimiento del mes algo aun por
  // venir). Devuelve totales y el desglose de gastos por categoria para
  // alimentar el grafico y los presupuestos del mes.
  const previstos = useMemo(() => {
    const zero = {
      ingresos: 0,
      gastos: 0,
      gastosPorCategoria: {} as Record<string, number>,
    };
    if (!settings) return zero;
    const now = new Date();
    const isCurrentMonth =
      periodAnio === now.getFullYear() && periodMes === now.getMonth() + 1;
    if (!isCurrentMonth) return zero;
    const nowMs = now.getTime();
    let ingresos = 0;
    let gastos = 0;
    const gastosPorCategoria: Record<string, number> = {};
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      const esIngreso =
        rule.tipoMovimiento === "ingreso" ||
        rule.tipoMovimiento === "intereses";
      const esGasto =
        rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
      if (!esIngreso && !esGasto) continue;
      let importe: number;
      try {
        importe = convert(rule.importe, rule.moneda, viewCurrency, rates);
      } catch {
        continue; // moneda no encontrada
      }
      // Todas las ocurrencias futuras del mes (semanal/diaria/varios-mes).
      for (const occ of occurrencesForRule(rule, periodAnio, periodMes)) {
        if (occ.getTime() <= nowMs) continue;
        if (esIngreso) {
          ingresos += importe;
        } else {
          gastos += importe;
          if (rule.categoriaId) {
            gastosPorCategoria[rule.categoriaId] =
              (gastosPorCategoria[rule.categoriaId] ?? 0) + importe;
          }
        }
      }
    }
    return { ingresos, gastos, gastosPorCategoria };
  }, [settings, periodAnio, periodMes, activeRules, rates, viewCurrency]);
  const ingresosPrevistos = previstos.ingresos;
  const gastosPrevistos = previstos.gastos;
  const gastosPrevistosPorCategoria = previstos.gastosPorCategoria;

  // Mortgage summary para descontar capital del patrimonio
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

  // Cuota mensual hipoteca en moneda vista (si toggle activo)
  const cuotaHipotecaVista = useMemo(() => {
    if (!settings?.integrarCuotaHipoteca) return 0;
    if (!mortgage || !mortgage.activa || !mortgageSummary) return 0;
    try {
      return convert(mortgageSummary.cuotaMensual, mortgage.moneda, viewCurrency, rates);
    } catch {
      return 0;
    }
  }, [settings, mortgage, mortgageSummary, viewCurrency, rates]);

  const summary = useMemo(() => {
    if (!baseSummary) return null;
    const ingresos = baseSummary.ingresos + ingresosPrevistos;
    const gastos = baseSummary.gastos + cuotaHipotecaVista + gastosPrevistos;
    const ahorro = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;
    return { ...baseSummary, ingresos, gastos, ahorro, tasaAhorro };
  }, [baseSummary, cuotaHipotecaVista, ingresosPrevistos, gastosPrevistos]);

  // Ahorro acumulado desde la fecha del objetivo de ahorro (primer tramo)
  // hasta el mes visto, limitado al anio visible (si el primer tramo es de un
  // anio anterior, arranca en enero). Solo cuenta cuando el mes visto es >= al
  // mes del objetivo. El objetivo acumulado se suma mes a mes resolviendo el
  // tramo vigente (asi refleja cambios a mitad de periodo). Coherente con el
  // KPI de Ahorro: anade cuota hipoteca y previstos del mes en curso.
  const ahorroAcumulado = useMemo(() => {
    const ancla = tramosAncla(objetivoTramos);
    if (!settings || !ancla) return null;
    if (periodKey(periodAnio, periodMes) < periodKey(ancla.anio, ancla.mes)) {
      return null;
    }
    const startMes = ancla.anio === periodAnio ? ancla.mes : 1;
    let ingresos = 0;
    let gastos = 0;
    let objetivoImporteAcum = 0; // en moneda vista
    let objetivoAhorroPctAcum = 0; // ahorro objetivo por % (ponderado por ingresos)
    let hayPct = false;
    for (let m = startMes; m <= periodMes; m++) {
      const s = summarizeMonth({
        mes: m,
        anio: periodAnio,
        movements: movementsAnio,
        rates,
        viewCurrency,
      });
      ingresos += s.ingresos;
      gastos += s.gastos;
      const tr = resolveTramo(objetivoTramos, periodAnio, m);
      if (tr) {
        if (tr.importe > 0) {
          try {
            objetivoImporteAcum += convert(
              tr.importe,
              tr.moneda,
              viewCurrency,
              rates,
            );
          } catch {
            // moneda no encontrada, ignorar
          }
        }
        if (tr.pct > 0) {
          hayPct = true;
          objetivoAhorroPctAcum += tr.pct * s.ingresos;
        }
      }
    }
    const numMeses = periodMes - startMes + 1;
    ingresos += ingresosPrevistos;
    gastos += cuotaHipotecaVista * numMeses + gastosPrevistos;
    const ahorro = ingresos - gastos;
    return {
      startMes,
      numMeses,
      ingresos,
      gastos,
      ahorro,
      objetivoImporteAcum,
      objetivoAhorroPctAcum,
      hayPct,
      hayImporte: objetivoImporteAcum > 0,
    };
  }, [
    settings,
    objetivoTramos,
    periodAnio,
    periodMes,
    movementsAnio,
    rates,
    viewCurrency,
    cuotaHipotecaVista,
    ingresosPrevistos,
    gastosPrevistos,
  ]);

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

  const deudaTotalVista = useMemo(() => {
    let total = 0;
    if (mortgage && mortgage.activa && mortgageSummary) {
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

  const patrimonioNeto = valorCuentas + portfolio.valorActualVista - deudaTotalVista;

  // Suma los gastos materializados (byCat) con los previstos del mes
  // (gastosPrevistosPorCategoria) para alimentar el grafico de categorias
  // y el progreso de presupuesto del mes.
  const gastosPorCategoriaConPrevistos = useMemo(() => {
    const filtered = filterMovementsByPeriod(movements, periodMes, periodAnio);
    const byCat = sumMovementsByCategory(filtered, rates, viewCurrency);
    const result: Record<string, number> = { ...byCat };
    for (const [catId, importe] of Object.entries(gastosPrevistosPorCategoria)) {
      result[catId] = (result[catId] ?? 0) + importe;
    }
    return result;
  }, [
    movements,
    periodMes,
    periodAnio,
    rates,
    viewCurrency,
    gastosPrevistosPorCategoria,
  ]);

  const categoryChartData = useMemo(() => {
    return Object.entries(gastosPorCategoriaConPrevistos)
      .map(([catId, value]) => {
        const cat = categoryById[catId];
        return {
          name: cat?.nombre ?? "(eliminada)",
          value,
          color: cat?.color ?? undefined,
        };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [gastosPorCategoriaConPrevistos, categoryById]);

  // Cambios de presupuesto con fecha, agrupados por categoria.
  const tramosByCat = useMemo(() => {
    const m: Record<string, typeof presupuestoTramos> = {};
    for (const t of presupuestoTramos) {
      (m[t.categoriaId] ??= []).push(t);
    }
    return m;
  }, [presupuestoTramos]);

  const budgetRows = useMemo(() => {
    const byCat = gastosPorCategoriaConPrevistos;

    return categories.map((c) => {
      // Presupuesto vigente en el mes visto (base de la categoria o ultimo
      // cambio con fecha <= mes).
      const presup = resolvePresupuesto(
        tramosByCat[c.id] ?? [],
        c.presupuestoMensual,
        c.presupuestoMoneda,
        periodAnio,
        periodMes,
      );
      let presupuestoView = 0;
      if (presup.importe > 0) {
        try {
          presupuestoView = convert(
            presup.importe,
            presup.moneda,
            viewCurrency,
            rates,
          );
        } catch {
          presupuestoView = 0;
        }
      }
      return {
        categoriaId: c.id,
        nombre: c.nombre,
        gastado: byCat[c.id] ?? 0,
        presupuesto: presupuestoView,
      };
    });
  }, [
    categories,
    tramosByCat,
    periodAnio,
    periodMes,
    gastosPorCategoriaConPrevistos,
    rates,
    viewCurrency,
  ]);

  if (!settings || !summary) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  // Objetivo de ahorro VIGENTE este mes (resuelto del tramo correspondiente).
  // Si no hay tramo para el mes (objetivo aun no efectivo), no afirmamos
  // cumplimiento.
  const objetivoMes = resolveTramo(objetivoTramos, periodAnio, periodMes);
  const objetivoPctMes = objetivoMes?.pct ?? 0;
  const cumpleObjetivo =
    objetivoPctMes > 0 && summary.tasaAhorro >= objetivoPctMes;
  const hayInversiones = investments.length > 0;

  // Valores de la tarjeta de ahorro acumulado vs objetivo (ya calculados mes
  // a mes en el memo, resolviendo el tramo vigente de cada mes).
  const objetivoImporteAcum = ahorroAcumulado?.objetivoImporteAcum ?? 0;
  const tasaAcum =
    ahorroAcumulado && ahorroAcumulado.ingresos > 0
      ? ahorroAcumulado.ahorro / ahorroAcumulado.ingresos
      : 0;
  // Tasa objetivo acumulada = ahorro objetivo (ponderado por ingresos) sobre
  // los ingresos del periodo.
  const objetivoTasaAcum =
    ahorroAcumulado && ahorroAcumulado.ingresos > 0
      ? ahorroAcumulado.objetivoAhorroPctAcum / ahorroAcumulado.ingresos
      : 0;
  const mostrarAcumulado =
    !!ahorroAcumulado && (ahorroAcumulado.hayPct || ahorroAcumulado.hayImporte);

  const kpiCols = hayInversiones
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen financiero del mes seleccionado.
            {cuotaHipotecaVista > 0 && (
              <span className="ml-1 italic">
                · Incluye cuota hipoteca de {money(cuotaHipotecaVista)}
              </span>
            )}
          </p>
        </div>
        <div data-tour="dashboard-period">
          <PeriodSelector
            anio={periodAnio}
            mes={periodMes}
            onChange={({ anio, mes }) => {
              setPeriodAnio(anio);
              setPeriodMes(mes);
            }}
          />
        </div>
      </header>

      <div data-tour="dashboard-kpis" className={`grid gap-4 ${kpiCols}`}>
        <KpiCard
          label="Ingresos"
          value={money(summary.ingresos)}
          icon={Wallet}
          intent="positive"
          hint={
            ingresosPrevistos > 0
              ? `Incluye ${money(ingresosPrevistos)} previstos`
              : summary.ingresos === 0
                ? "Sin ingresos este mes"
                : undefined
          }
        />
        <KpiCard
          label="Gastos"
          value={money(summary.gastos)}
          icon={TrendingDown}
          hint={
            gastosPrevistos > 0
              ? `Incluye ${money(gastosPrevistos)} previstos${
                  cuotaHipotecaVista > 0 ? " + cuota hipoteca" : ""
                }`
              : cuotaHipotecaVista > 0
                ? "Incluye cuota hipoteca"
                : undefined
          }
        />
        <KpiCard
          label="Ahorro"
          value={money(summary.ahorro)}
          icon={PiggyBank}
          intent={summary.ahorro >= 0 ? "positive" : "negative"}
          hint={
            summary.ingresos > 0
              ? `Tasa: ${(summary.tasaAhorro * 100).toFixed(0)}%${
                  cumpleObjetivo ? " · objetivo cumplido" : ""
                }`
              : "Sin ingresos este mes"
          }
        />
        <KpiCard
          label="Patrimonio neto"
          value={money(patrimonioNeto)}
          icon={Coins}
          hint={
            deudaTotalVista > 0
              ? `Descontada deuda: ${money(deudaTotalVista)}`
              : hayInversiones
              ? `Cuentas + cartera`
              : "Saldo total de cuentas activas"
          }
        />
        {hayInversiones && (
          <KpiCard
            label="Valor cartera"
            value={money(portfolio.valorActualVista)}
            icon={PieIcon}
            intent={portfolio.plAbsolutoVista >= 0 ? "positive" : "negative"}
            hint={`${portfolio.plAbsolutoVista >= 0 ? "+" : ""}${(
              portfolio.plPorcentaje * 100
            ).toFixed(2)}%`}
          />
        )}
      </div>

      {mostrarAcumulado && ahorroAcumulado && (
        <Card data-tour="dashboard-ahorro">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4" />
              Ahorro acumulado vs objetivo
            </CardTitle>
            <CardDescription>
              {MESES_ES[ahorroAcumulado.startMes - 1]} a {MESES_ES[periodMes - 1]}{" "}
              {periodAnio} ({ahorroAcumulado.numMeses}{" "}
              {ahorroAcumulado.numMeses === 1 ? "mes" : "meses"}) · desde tu
              objetivo de ahorro
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Ahorro acumulado</p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  ahorroAcumulado.ahorro >= 0
                    ? "text-primary"
                    : "text-destructive",
                )}
              >
                {money(ahorroAcumulado.ahorro)}
              </p>
              {ahorroAcumulado.hayImporte && (
                <p className="text-xs text-muted-foreground">
                  Objetivo: {money(objetivoImporteAcum)}{" "}
                  {ahorroAcumulado.ahorro >= objetivoImporteAcum
                    ? "✓"
                    : `· faltan ${money(
                        objetivoImporteAcum - ahorroAcumulado.ahorro,
                      )}`}
                </p>
              )}
            </div>
            {ahorroAcumulado.hayPct && (
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Tasa acumulada</p>
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    tasaAcum >= objetivoTasaAcum
                      ? "text-primary"
                      : "text-foreground",
                  )}
                >
                  {(tasaAcum * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Objetivo: {(objetivoTasaAcum * 100).toFixed(0)}%{" "}
                  {tasaAcum >= objetivoTasaAcum ? "✓" : "✗"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertsCard
        rows={budgetRows}
        viewCurrency={viewCurrency}
        dataTour="dashboard-avisos"
      />

      <CashflowCard dataTour="dashboard-cashflow" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryChart
          data={categoryChartData}
          viewCurrency={viewCurrency}
          title="Gasto por categoria"
          description="Distribucion del gasto del mes"
          dataTour="dashboard-categoria"
        />
        <BudgetProgress
          rows={budgetRows}
          viewCurrency={viewCurrency}
          dataTour="dashboard-presupuesto"
        />
      </div>

      <RecentMovements
        movements={movements}
        categoryNames={categoryNamesMap}
        accountNames={accountNamesMap}
        max={8}
        dataTour="dashboard-recientes"
      />
    </div>
  );
}
