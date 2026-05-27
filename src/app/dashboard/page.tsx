"use client";

/**
 * ============================================================================
 *  src/app/dashboard/page.tsx — Dashboard principal (Lote 7)
 * ============================================================================
 *
 *  Cambios vs Lote 6:
 *    - El KPI "Patrimonio neto" ahora suma:
 *        cuentas activas + valor cartera de inversiones
 *    - Nuevo KPI quinto: "Valor cartera" (si hay inversiones)
 *    - Layout adaptativo: 4 columnas si no hay inversiones, 5 si las hay
 * ============================================================================
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
import { useAccounts } from "@/hooks/useAccounts";
import { useExpenses } from "@/hooks/useExpenses";
import { useMonthlyIncomes } from "@/hooks/useMonthlyIncomes";
import { useExtraIncomes } from "@/hooks/useExtraIncomes";
import { useInvestments } from "@/hooks/useInvestments";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentExpenses } from "@/components/dashboard/RecentExpenses";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import {
  summarizeMonth,
  sumExpensesByCategory,
  filterExpensesByPeriod,
} from "@/lib/domain/aggregation";
import { summarizePortfolio } from "@/lib/domain/investments";

export default function DashboardPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { investments } = useInvestments();

  const today = new Date();
  const [periodAnio, setPeriodAnio] = useLocalStorage<number>(
    "dashboard:anio",
    settings?.anioActual ?? today.getFullYear(),
  );
  const [periodMes, setPeriodMes] = useLocalStorage<number>(
    "dashboard:mes",
    settings?.mesActual ?? today.getMonth() + 1,
  );

  const { expenses } = useExpenses({ anio: periodAnio, mes: periodMes });
  const { rows: monthlyIncomes } = useMonthlyIncomes(
    periodAnio,
    settings?.monedaLocal ?? "EUR",
  );
  const { extras } = useExtraIncomes({ anio: periodAnio });

  const categoryById = useMemo(() => {
    const m: Record<string, { nombre: string; color: string | null }> = {};
    for (const c of categories) m[c.id] = { nombre: c.nombre, color: c.color };
    return m;
  }, [categories]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const summary = useMemo(() => {
    if (!settings) return null;
    return summarizeMonth({
      mes: periodMes,
      anio: periodAnio,
      expenses,
      monthlyIncomes,
      extraIncomes: extras,
      rates,
      viewCurrency,
    });
  }, [settings, periodMes, periodAnio, expenses, monthlyIncomes, extras, rates, viewCurrency]);

  // Valor de cuentas activas en moneda vista
  const valorCuentas = useMemo(() => {
    let total = 0;
    for (const a of accounts) {
      if (!a.activa) continue;
      try {
        total += convert(a.saldo, a.moneda, viewCurrency, rates);
      } catch {
        // ignorar
      }
    }
    return total;
  }, [accounts, rates, viewCurrency]);

  // Resumen de la cartera de inversiones en moneda vista
  const portfolio = useMemo(
    () => summarizePortfolio(investments, rates, viewCurrency),
    [investments, rates, viewCurrency],
  );

  // Patrimonio neto = cuentas + inversiones
  const patrimonioNeto = valorCuentas + portfolio.valorActualVista;

  // Categoría datos para gráfico
  const categoryChartData = useMemo(() => {
    const filtered = filterExpensesByPeriod(expenses, periodMes, periodAnio);
    const byCat = sumExpensesByCategory(filtered, rates, viewCurrency);
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
  }, [expenses, periodMes, periodAnio, rates, viewCurrency, categoryById]);

  const budgetRows = useMemo(() => {
    const filtered = filterExpensesByPeriod(expenses, periodMes, periodAnio);
    const byCat = sumExpensesByCategory(filtered, rates, viewCurrency);

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
  }, [categories, expenses, periodMes, periodAnio, rates, viewCurrency]);

  const categoryNamesMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.nombre;
    return m;
  }, [categories]);

  if (!settings || !summary) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const objetivoAhorro = settings.objetivoAhorroPct;
  const cumpleObjetivo = summary.tasaAhorro >= objetivoAhorro;
  const hayInversiones = investments.length > 0;

  // El grid de KPIs cambia segun haya o no inversiones
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

      {/* KPI grid */}
      <div className={`grid gap-4 ${kpiCols}`}>
        <KpiCard
          label="Ingresos"
          value={formatAmount(summary.ingresos, viewCurrency)}
          icon={Wallet}
          intent="positive"
        />
        <KpiCard
          label="Gastos"
          value={formatAmount(summary.gastos, viewCurrency)}
          icon={TrendingDown}
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
            hayInversiones
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

      <RecentExpenses expenses={expenses} categoryNames={categoryNamesMap} max={8} />
    </div>
  );
}
