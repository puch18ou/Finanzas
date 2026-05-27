/**
 * ============================================================================
 *  src/lib/domain/aggregation.ts — Agregaciones (SUMIFS, GROUPBY, etc)
 * ============================================================================
 *
 *  Funciones puras que toman colecciones (gastos, ingresos, inversiones)
 *  y devuelven resumenes utiles para Dashboard y vistas.
 *
 *  POR QUE EN MEMORIA Y NO EN SQL
 *  ------------------------------
 *  Para los volumenes de datos personales (miles de gastos al año, no
 *  millones), procesar en JavaScript es perfectamente eficiente y nos
 *  da maxima flexibilidad. Si crece mucho, migraremos las hot paths a
 *  queries SQL agregadas.
 *
 *  Ademas, todas estas funciones reciben datos YA convertidos a la
 *  moneda vista. La conversion la hace el caller usando convert() del
 *  modulo currency. Esto separa responsabilidades.
 * ============================================================================
 */

import type { Expense, ExtraIncome, MonthlyIncome } from "@/lib/db/schema";
import { convert, type RatesMap } from "./currency";

/**
 * Suma los importes de una lista de gastos, convertidos a la moneda vista.
 * Filtra antes los borrados (soft delete) por seguridad: la lista deberia
 * llegar ya sin borrados, pero por robustez los descartamos aqui tambien.
 */
export function sumExpensesInView(
  expenses: Expense[],
  rates: RatesMap,
  viewCurrency: string,
): number {
  let total = 0;
  for (const e of expenses) {
    if (e.deletedAt !== null) continue;
    total += convert(e.importe, e.moneda, viewCurrency, rates);
  }
  return total;
}

/**
 * Filtra una lista de gastos por mes y anio. Util como pre-paso a sum.
 */
export function filterExpensesByPeriod(
  expenses: Expense[],
  mes: number,
  anio: number,
): Expense[] {
  return expenses.filter(
    (e) => e.deletedAt === null && e.mes === mes && e.anio === anio,
  );
}

/**
 * Filtra una lista de gastos por anio completo (todos los meses).
 */
export function filterExpensesByYear(
  expenses: Expense[],
  anio: number,
): Expense[] {
  return expenses.filter((e) => e.deletedAt === null && e.anio === anio);
}

/**
 * Agrupa una lista de gastos por categoria, devolviendo un mapa
 * categoria_id → total convertido a la moneda vista.
 */
export function sumExpensesByCategory(
  expenses: Expense[],
  rates: RatesMap,
  viewCurrency: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of expenses) {
    if (e.deletedAt !== null) continue;
    const value = convert(e.importe, e.moneda, viewCurrency, rates);
    result[e.categoriaId] = (result[e.categoriaId] ?? 0) + value;
  }
  return result;
}

/**
 * Suma los ingresos mensuales de un mes/anio especifico. Devuelve el
 * total convertido a la moneda vista. Si no hay fila para ese mes/anio,
 * devuelve 0.
 */
export function sumMonthlyIncomeInView(
  incomes: MonthlyIncome[],
  mes: number,
  anio: number,
  rates: RatesMap,
  viewCurrency: string,
): number {
  const row = incomes.find(
    (i) => i.deletedAt === null && i.mes === mes && i.anio === anio,
  );
  if (!row) return 0;

  const total = row.salario + row.bonus + row.otros;
  return convert(total, row.moneda, viewCurrency, rates);
}

/**
 * Suma todos los ingresos puntuales de un mes/anio, en moneda vista.
 */
export function sumExtraIncomesInView(
  extras: ExtraIncome[],
  mes: number,
  anio: number,
  rates: RatesMap,
  viewCurrency: string,
): number {
  let total = 0;
  for (const e of extras) {
    if (e.deletedAt !== null) continue;
    if (e.mes !== mes || e.anio !== anio) continue;
    total += convert(e.importe, e.moneda, viewCurrency, rates);
  }
  return total;
}

/**
 * Resumen mensual de ingresos, gastos, ahorro y tasa de ahorro para un
 * mes especifico. Es el bloque base del Dashboard y de la pagina Evolucion.
 */
export type MonthSummary = {
  mes: number;
  anio: number;
  ingresos: number;
  gastos: number;
  ahorro: number;
  /** ahorro / ingresos. Si ingresos = 0, tasa = 0. */
  tasaAhorro: number;
};

export function summarizeMonth(args: {
  mes: number;
  anio: number;
  expenses: Expense[];
  monthlyIncomes: MonthlyIncome[];
  extraIncomes: ExtraIncome[];
  rates: RatesMap;
  viewCurrency: string;
}): MonthSummary {
  const ingresos =
    sumMonthlyIncomeInView(args.monthlyIncomes, args.mes, args.anio, args.rates, args.viewCurrency) +
    sumExtraIncomesInView(args.extraIncomes, args.mes, args.anio, args.rates, args.viewCurrency);

  const filtered = filterExpensesByPeriod(args.expenses, args.mes, args.anio);
  const gastos = sumExpensesInView(filtered, args.rates, args.viewCurrency);

  const ahorro = ingresos - gastos;
  const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;

  return {
    mes: args.mes,
    anio: args.anio,
    ingresos,
    gastos,
    ahorro,
    tasaAhorro,
  };
}

/**
 * Resumen de los 12 meses de un anio. Itera summarizeMonth.
 * Ideal para la pagina de Evolucion y para tablas anuales.
 */
export function summarizeYear(args: {
  anio: number;
  expenses: Expense[];
  monthlyIncomes: MonthlyIncome[];
  extraIncomes: ExtraIncome[];
  rates: RatesMap;
  viewCurrency: string;
}): MonthSummary[] {
  const result: MonthSummary[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    result.push(
      summarizeMonth({
        mes,
        anio: args.anio,
        expenses: args.expenses,
        monthlyIncomes: args.monthlyIncomes,
        extraIncomes: args.extraIncomes,
        rates: args.rates,
        viewCurrency: args.viewCurrency,
      }),
    );
  }
  return result;
}
