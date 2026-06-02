"use client";

/**
 * src/app/dashboard/page.tsx — Dashboard (Lote 10a-3)
 *
 * Eliminada la dependencia de monthly_incomes. Los ingresos vienen solo
 * de movements tipo ingreso/intereses. Hasta el Lote 11, el salario no
 * se cuenta automaticamente — el usuario tendra que meterlo a mano
 * como movement tipo "ingreso" si quiere verlo en el Dashboard.
 */

import { useMemo } from "react";
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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { computeUpcomingFromRule } from "@/lib/domain/recurring";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
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
  const [periodAnio, setPeriodAnio] = useLocalStorage<number>(
    "dashboard:anio",
    settings?.anioActual ?? today.getFullYear(),
  );
  const [periodMes, setPeriodMes] = useLocalStorage<number>(
    "dashboard:mes",
    settings?.mesActual ?? today.getMonth() + 1,
  );

  const { movements } = useMovements({ anio: periodAnio, mes: periodMes });
  const { data: activeRules = [] } = useActiveRecurringRules();

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

  // Ingresos PREVISTOS de este mes: ocurrencias futuras de reglas recurrentes
  // tipo 'ingreso' o 'intereses' que aun no se han materializado (Lote 15c).
  // Solo se anaden si el periodo seleccionado es el mes actual o futuro.
  const ingresosPrevistos = useMemo(() => {
    if (!settings) return 0;
    const now = new Date();
    const endOfPeriod = new Date(periodAnio, periodMes, 0, 23, 59, 59);
    if (endOfPeriod.getTime() <= now.getTime()) return 0;
    const daysAhead = Math.ceil(
      (endOfPeriod.getTime() - now.getTime()) / (1000 * 3600 * 24),
    );
    let total = 0;
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      if (rule.tipoMovimiento !== "ingreso" && rule.tipoMovimiento !== "intereses") {
        continue;
      }
      const upcoming = computeUpcomingFromRule(rule, now, daysAhead);
      for (const u of upcoming) {
        if (u.anio !== periodAnio || u.mes !== periodMes) continue;
        try {
          total += convert(rule.importe, rule.moneda, viewCurrency, rates);
        } catch {
          // moneda no encontrada, ignorar
        }
      }
    }
    return total;
  }, [settings, periodAnio, periodMes, activeRules, rates, viewCurrency]);

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
    const gastos = baseSummary.gastos + cuotaHipotecaVista;
    const ahorro = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;
    return { ...baseSummary, ingresos, gastos, ahorro, tasaAhorro };
  }, [baseSummary, cuotaHipotecaVista, ingresosPrevistos]);

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

  const categoryChartData = useMemo(() => {
    const filtered = filterMovementsByPeriod(movements, periodMes, periodAnio);
    const byCat = sumMovementsByCategory(filtered, rates, viewCurrency);
    return Object.entries(byCat)
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
  }, [movements, periodMes, periodAnio, rates, viewCurrency, categoryById]);

  const budgetRows = useMemo(() => {
    const filtered = filterMovementsByPeriod(movements, periodMes, periodAnio);
    const byCat = sumMovementsByCategory(filtered, rates, viewCurrency);

    return categories.map((c) => {
      let presupuestoView = 0;
      if (c.presupuestoMensual > 0) {
        try {
          presupuestoView = convert(
            c.presupuestoMensual,
            c.presupuestoMoneda,
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
  }, [categories, movements, periodMes, periodAnio, rates, viewCurrency]);

  if (!settings || !summary) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const objetivoAhorro = settings.objetivoAhorroPct;
  const cumpleObjetivo = summary.tasaAhorro >= objetivoAhorro;
  const hayInversiones = investments.length > 0;

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
                · Incluye cuota hipoteca de {formatAmount(cuotaHipotecaVista, viewCurrency)}
              </span>
            )}
          </p>
        </div>
        <PeriodSelector
          anio={periodAnio}
          mes={periodMes}
          onChange={({ anio, mes }) => {
            setPeriodAnio(anio);
            setPeriodMes(mes);
          }}
        />
      </header>

      <div className={`grid gap-4 ${kpiCols}`}>
        <KpiCard
          label="Ingresos"
          value={formatAmount(summary.ingresos, viewCurrency)}
          icon={Wallet}
          intent="positive"
          hint={
            ingresosPrevistos > 0
              ? `Incluye ${formatAmount(ingresosPrevistos, viewCurrency)} previstos`
              : summary.ingresos === 0
                ? "Sin ingresos este mes"
                : undefined
          }
        />
        <KpiCard
          label="Gastos"
          value={formatAmount(summary.gastos, viewCurrency)}
          icon={TrendingDown}
          hint={cuotaHipotecaVista > 0 ? "Incluye cuota hipoteca" : undefined}
        />
        <KpiCard
          label="Ahorro"
          value={formatAmount(summary.ahorro, viewCurrency)}
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
          value={formatAmount(patrimonioNeto, viewCurrency)}
          icon={Coins}
          hint={
            deudaTotalVista > 0
              ? `Descontada deuda: ${formatAmount(deudaTotalVista, viewCurrency)}`
              : hayInversiones
              ? `Cuentas + cartera`
              : "Saldo total de cuentas activas"
          }
        />
        {hayInversiones && (
          <KpiCard
            label="Valor cartera"
            value={formatAmount(portfolio.valorActualVista, viewCurrency)}
            icon={PieIcon}
            intent={portfolio.plAbsolutoVista >= 0 ? "positive" : "negative"}
            hint={`${portfolio.plAbsolutoVista >= 0 ? "+" : ""}${(
              portfolio.plPorcentaje * 100
            ).toFixed(2)}%`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryChart
          data={categoryChartData}
          viewCurrency={viewCurrency}
          title="Gasto por categoria"
          description="Distribucion del gasto del mes"
        />
        <BudgetProgress rows={budgetRows} viewCurrency={viewCurrency} />
      </div>

      <RecentMovements
        movements={movements}
        categoryNames={categoryNamesMap}
        accountNames={accountNamesMap}
        max={8}
      />
    </div>
  );
}
