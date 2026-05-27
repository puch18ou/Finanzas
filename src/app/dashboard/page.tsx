"use client";

/**
 * ============================================================================
 *  src/app/dashboard/page.tsx — Dashboard principal (Lote 8)
 * ============================================================================
 *
 *  Cambios vs Lote 7:
 *    - Si `settings.integrarCuotaHipoteca` esta activo Y hay hipoteca
 *      activa, la cuota mensual (calculada en vivo) se suma a los gastos
 *      del KPI "Gastos" y al calculo de Ahorro.
 *    - Patrimonio neto descuenta:
 *        + Capital prestado de la hipoteca activa (= precioVivienda
 *          - entrada + gastosAsociados)
 *        + Capital pendiente de Otras deudas
 *      todo convertido a moneda vista.
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
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
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
import { summarizeMortgage } from "@/lib/domain/mortgage";

export default function DashboardPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
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

  const baseSummary = useMemo(() => {
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

  // Resumen de la hipoteca (capitalPrestado, cuotaMensual, etc.)
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

  // Cuota mensual hipoteca en moneda vista (si aplica)
  const cuotaHipotecaVista = useMemo(() => {
    if (!settings?.integrarCuotaHipoteca) return 0;
    if (!mortgage || !mortgage.activa || !mortgageSummary) return 0;
    try {
      return convert(mortgageSummary.cuotaMensual, mortgage.moneda, viewCurrency, rates);
    } catch {
      return 0;
    }
  }, [settings, mortgage, mortgageSummary, viewCurrency, rates]);

  // Resumen final con cuota integrada
  const summary = useMemo(() => {
    if (!baseSummary) return null;
    if (cuotaHipotecaVista === 0) return baseSummary;
    const gastos = baseSummary.gastos + cuotaHipotecaVista;
    const ahorro = baseSummary.ingresos - gastos;
    const tasaAhorro = baseSummary.ingresos > 0 ? ahorro / baseSummary.ingresos : 0;
    return { ...baseSummary, gastos, ahorro, tasaAhorro };
  }, [baseSummary, cuotaHipotecaVista]);

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

  const portfolio = useMemo(
    () => summarizePortfolio(investments, rates, viewCurrency),
    [investments, rates, viewCurrency],
  );

  // Deuda total = capital prestado de hipoteca activa + capital pendiente de otras deudas
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
      } catch {
        // ignorar
      }
    }
    for (const d of debts) {
      try {
        total += convert(d.capitalPendiente, d.moneda, viewCurrency, rates);
      } catch {
        // ignorar
      }
    }
    return total;
  }, [mortgage, mortgageSummary, debts, rates, viewCurrency]);

  const patrimonioNeto = valorCuentas + portfolio.valorActualVista - deudaTotalVista;

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

      <RecentExpenses expenses={expenses} categoryNames={categoryNamesMap} max={8} />
    </div>
  );
}
