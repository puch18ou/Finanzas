"use client";

/**
 * ============================================================================
 *  src/app/dashboard/page.tsx — Dashboard principal
 * ============================================================================
 *
 *  Vista resumen del mes seleccionado. Compone:
 *
 *    [Selector de periodo propio (no afecta a Ajustes)]
 *    [4 KPIs grandes: Ingresos, Gastos, Ahorro, Patrimonio neto]
 *    [Grafico de gasto por categoria (configurable)]
 *    [Presupuesto vs real]
 *    [Ultimos gastos]
 *
 *  El periodo seleccionado vive en localStorage para que persista entre
 *  visitas a la pagina.
 *
 *  CALCULO DE PATRIMONIO NETO
 *  --------------------------
 *  Patrimonio = (saldos cuentas + valor inversiones - deudas pendientes)
 *               todo convertido a moneda vista.
 *  La hipoteca aparece como deuda si tieneHipoteca=true.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Coins,
} from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useExpenses } from "@/hooks/useExpenses";
import { useMonthlyIncomes } from "@/hooks/useMonthlyIncomes";
import { useExtraIncomes } from "@/hooks/useExtraIncomes";
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

export default function DashboardPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const today = new Date();
  // Periodo del Dashboard: persistente en localStorage. La primera vez
  // toma el del Ajustes; despues se recuerda lo que el usuario eligio.
  const [periodAnio, setPeriodAnio] = useLocalStorage<number>(
    "dashboard:anio",
    settings?.anioActual ?? today.getFullYear(),
  );
  const [periodMes, setPeriodMes] = useLocalStorage<number>(
    "dashboard:mes",
    settings?.mesActual ?? today.getMonth() + 1,
  );

  // Necesitamos TODOS los gastos del mes (sin paginar) y los ingresos del año
  const { expenses } = useExpenses({ anio: periodAnio, mes: periodMes });
  const { rows: monthlyIncomes } = useMonthlyIncomes(
    periodAnio,
    settings?.monedaLocal ?? "EUR",
  );
  const { extras } = useExtraIncomes({ anio: periodAnio });

  // Look-ups
  const categoryById = useMemo(() => {
    const m: Record<string, { nombre: string; color: string | null }> = {};
    for (const c of categories) m[c.id] = { nombre: c.nombre, color: c.color };
    return m;
  }, [categories]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Resumen del mes (en moneda vista)
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

  // Patrimonio neto (suma de cuentas activas, en moneda vista)
  // Las inversiones, hipoteca y otras deudas las anadiremos en Lote 7+
  const patrimonioNeto = useMemo(() => {
    let total = 0;
    for (const a of accounts) {
      if (!a.activa) continue;
      try {
        total += convert(a.saldo, a.moneda, viewCurrency, rates);
      } catch {
        // ignorar cuenta con moneda invalida
      }
    }
    return total;
  }, [accounts, rates, viewCurrency]);

  // Datos del grafico de categorias (convertidos a vista, con nombre)
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

  // Presupuesto vs real (en moneda vista)
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

  // Categoria-id → nombre para el componente RecentExpenses
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          hint="Saldo total de cuentas activas"
        />
      </div>

      {/* Gráficos + presupuesto + últimos */}
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
