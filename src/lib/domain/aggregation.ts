/**
 * ============================================================================
 *  src/lib/domain/aggregation.ts — Agregaciones para Dashboard/Evolucion
 * ============================================================================
 *
 *  Lote 10a-3: eliminada la dependencia de `monthlyIncomes`. Los ingresos
 *  vienen exclusivamente de movements (tipo: ingreso o intereses).
 *
 *  Hasta que llegue el Lote 11 (movements recurrentes), el salario
 *  mensual NO se contara automaticamente. El usuario tendra que meterlo
 *  como movement tipo 'ingreso' a mano, o esperar al Lote 11.
 *
 *  CONCEPTOS
 *  ---------
 *    "Gastos del periodo" = movimientos con tipo ∈ {gasto, cuota}
 *      MENOS las devoluciones (tipo 'devolucion'), que reembolsan un gasto y
 *      por tanto RESTAN del gasto neto de su categoria (no son ingresos).
 *    "Ingresos del periodo" = movimientos con tipo ∈ {ingreso, intereses}
 *    "Transferencias y ajustes" NO se suman a ingresos ni gastos.
 *
 *  El monto siempre se trata POSITIVO. La direccion la decide el tipo: gasto y
 *  cuota suman a gastos; devolucion resta de gastos.
 * ============================================================================
 */

import type { Movement, RecurringRule } from "@/lib/db/schema";
import { convert, type RatesMap } from "./currency";
import { costeReal, sumRefundsInCurrency } from "./refunds";
import { occurrencesForRule } from "./recurring";

const TIPOS_GASTO = new Set(["gasto", "cuota"]);
const TIPOS_INGRESO = new Set(["ingreso", "intereses"]);
const TIPO_DEVOLUCION = "devolucion";

export type PeriodSummary = {
  ingresos: number;
  gastos: number;
  ahorro: number;
  tasaAhorro: number; // 0..1
};

export type SummarizeMonthArgs = {
  mes: number;
  anio: number;
  movements: Movement[];
  rates: RatesMap;
  viewCurrency: string;
};

/**
 * Calcula los totales del mes en moneda vista.
 */
export function summarizeMonth(args: SummarizeMonthArgs): PeriodSummary {
  const { mes, anio, movements, rates, viewCurrency } = args;

  const movsMes = filterMovementsByPeriod(movements, mes, anio);

  let gastos = 0;
  let ingresos = 0;

  for (const m of movsMes) {
    if (TIPOS_GASTO.has(m.tipo)) {
      try {
        gastos += convert(m.importe, m.moneda, viewCurrency, rates);
      } catch {
        // Si la moneda no tiene rate, lo ignoramos
      }
    } else if (m.tipo === TIPO_DEVOLUCION) {
      try {
        gastos -= convert(m.importe, m.moneda, viewCurrency, rates);
      } catch {
        // ignorar
      }
    } else if (TIPOS_INGRESO.has(m.tipo)) {
      try {
        ingresos += convert(m.importe, m.moneda, viewCurrency, rates);
      } catch {
        // ignorar
      }
    }
  }

  const ahorro = ingresos - gastos;
  const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;

  return { ingresos, gastos, ahorro, tasaAhorro };
}

/**
 * Filtra movimientos a los de un mes/anio concreto.
 */
export function filterMovementsByPeriod(
  movements: Movement[],
  mes: number,
  anio: number,
): Movement[] {
  return movements.filter((m) => m.mes === mes && m.anio === anio);
}

/**
 * Un movimiento individual imputado a una categoria, con su valor ya convertido
 * a moneda vista. `valorVista` lleva el SIGNO neto: gasto/cuota positivo,
 * devolucion negativo (igual que en `sumMovementsByCategory`). Sirve para
 * DESGLOSAR el consumo de un presupuesto ("en que se ha ido el dinero").
 *
 * Si el movimiento es un gasto con DEVOLUCIONES ASOCIADAS (dentro del mismo
 * periodo), estas se FUNDEN en su linea: `importeNeto` es el coste real (gasto
 * menos lo devuelto, en la moneda del gasto), `devuelto` es lo descontado y
 * `valorVista` ya viene neto. Esas devoluciones NO aparecen como linea aparte.
 */
export type CategoryMovementItem = {
  movement: Movement;
  valorVista: number;
  // Importe a mostrar, en la moneda del movimiento: para un gasto con
  // devoluciones asociadas es el coste real; en el resto, su propio importe.
  importeNeto: number;
  // Devoluciones asociadas descontadas (en la moneda del gasto). 0 si ninguna.
  devuelto: number;
};

/**
 * Lista, por categoria, los movimientos que componen su gasto neto (gasto,
 * cuota y devolucion), cada uno con su `valorVista` (moneda vista, con signo).
 * Cada lista viene ORDENADA de mayor a menor valor (los gastos grandes primero,
 * las devoluciones sueltas al final). La suma de cada lista coincide con el
 * valor de `sumMovementsByCategory` para esa categoria.
 *
 * Las devoluciones ASOCIADAS a un gasto presente en la lista se descuentan de
 * ese gasto (coste real) en vez de aparecer sueltas. Las devoluciones sin gasto
 * asociado (o cuyo gasto no esta en este periodo) si salen como linea propia.
 */
export function listMovementsByCategory(
  movements: Movement[],
  rates: RatesMap,
  viewCurrency: string,
): Record<string, CategoryMovementItem[]> {
  // Ids de los gastos/cuotas presentes en este conjunto (con categoria): solo
  // fundimos una devolucion en su gasto si ese gasto esta aqui.
  const gastoIds = new Set(
    movements
      .filter(
        (m) => TIPOS_GASTO.has(m.tipo) && m.categoriaId != null,
      )
      .map((m) => m.id),
  );

  // Devoluciones asociadas a un gasto presente, agrupadas por gasto: el importe
  // original (para el coste real en la moneda del gasto) y su valor en moneda
  // vista (para descontar del `valorVista`).
  const devByGasto: Record<
    string,
    { importe: number; moneda: string }[]
  > = {};
  const devVistaByGasto: Record<string, number> = {};
  for (const m of movements) {
    if (m.tipo !== TIPO_DEVOLUCION) continue;
    const gid = m.gastoAsociadoId;
    if (!gid || !gastoIds.has(gid)) continue;
    (devByGasto[gid] ??= []).push({ importe: m.importe, moneda: m.moneda });
    try {
      devVistaByGasto[gid] =
        (devVistaByGasto[gid] ?? 0) +
        convert(m.importe, m.moneda, viewCurrency, rates);
    } catch {
      // moneda sin tipo de cambio: no se puede descontar, se ignora (coherente
      // con sumMovementsByCategory, que tambien la ignoraria).
    }
  }

  const result: Record<string, CategoryMovementItem[]> = {};
  for (const m of movements) {
    const esGasto = TIPOS_GASTO.has(m.tipo);
    const esDevolucion = m.tipo === TIPO_DEVOLUCION;
    if (!esGasto && !esDevolucion) continue;
    if (!m.categoriaId) continue;

    // Devolucion ya fundida en su gasto: no la sacamos como linea aparte.
    if (esDevolucion && m.gastoAsociadoId && gastoIds.has(m.gastoAsociadoId)) {
      continue;
    }

    let value = 0;
    try {
      value = convert(m.importe, m.moneda, viewCurrency, rates);
    } catch {
      continue;
    }

    if (esDevolucion) {
      (result[m.categoriaId] ??= []).push({
        movement: m,
        valorVista: -value,
        importeNeto: m.importe,
        devuelto: 0,
      });
    } else {
      const devVista = devVistaByGasto[m.id] ?? 0;
      const devuelto = sumRefundsInCurrency(
        devByGasto[m.id] ?? [],
        m.moneda,
        rates,
      );
      (result[m.categoriaId] ??= []).push({
        movement: m,
        valorVista: value - devVista,
        importeNeto: costeReal(m.importe, devuelto),
        devuelto,
      });
    }
  }

  for (const list of Object.values(result)) {
    list.sort((a, b) => b.valorVista - a.valorVista);
  }
  return result;
}

// ============================================================================
//  PREVISTOS (recurrentes aun no generados de un mes)
// ============================================================================

export type PrevistosMes = {
  ingresos: number;
  gastos: number;
  /** Gasto previsto por categoriaId (moneda vista). */
  porCategoria: Record<string, number>;
};

/**
 * Ingresos/gastos PREVISTOS de un mes: ocurrencias de reglas recurrentes que
 * aun no han pasado (fecha > now) en ese (anio, mes). Mismo criterio que usan
 * el dashboard, evolucion y movil. Excluye reglas de inversion. En moneda vista.
 *
 * Tipicamente se llama para el mes ACTUAL (los futuros no cuentan como "de este
 * mes" y los pasados ya estan materializados).
 */
export function previstosDelMes(
  rules: RecurringRule[],
  anio: number,
  mes: number,
  now: Date,
  rates: RatesMap,
  viewCurrency: string,
): PrevistosMes {
  const nowMs = now.getTime();
  let ingresos = 0;
  let gastos = 0;
  const porCategoria: Record<string, number> = {};

  for (const rule of rules) {
    if (!rule.activa) continue;
    if (rule.origenAutomatico === "investment") continue;
    const esIngreso =
      rule.tipoMovimiento === "ingreso" || rule.tipoMovimiento === "intereses";
    const esGasto =
      rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
    if (!esIngreso && !esGasto) continue;

    let importe: number;
    try {
      importe = convert(rule.importe, rule.moneda, viewCurrency, rates);
    } catch {
      continue; // moneda sin tipo de cambio
    }

    for (const occ of occurrencesForRule(rule, anio, mes)) {
      if (occ.getTime() <= nowMs) continue;
      if (esIngreso) {
        ingresos += importe;
      } else {
        gastos += importe;
        if (rule.categoriaId) {
          porCategoria[rule.categoriaId] =
            (porCategoria[rule.categoriaId] ?? 0) + importe;
        }
      }
    }
  }

  return { ingresos, gastos, porCategoria };
}

/** Una ocurrencia de gasto PREVISTA (recurrente aun no generada) de un mes. */
export type PrevistoItem = {
  /** Clave estable para React (regla + fecha). */
  id: string;
  concepto: string;
  fecha: Date;
  /** Importe en la moneda de la regla. */
  importe: number;
  moneda: string;
  /** Importe convertido a moneda vista. */
  valorVista: number;
};

/**
 * Gastos PREVISTOS por categoria de un mes, detallados (fecha + concepto +
 * importe), para mostrarlos en el desglose del presupuesto. Solo gasto/cuota
 * con categoria, ocurrencias con fecha > now, excluye inversion. Cada lista va
 * ordenada por fecha.
 */
export function previstoItemsByCategory(
  rules: RecurringRule[],
  anio: number,
  mes: number,
  now: Date,
  rates: RatesMap,
  viewCurrency: string,
): Record<string, PrevistoItem[]> {
  const nowMs = now.getTime();
  const out: Record<string, PrevistoItem[]> = {};

  for (const rule of rules) {
    if (!rule.activa) continue;
    if (rule.origenAutomatico === "investment") continue;
    const esGasto =
      rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
    if (!esGasto || !rule.categoriaId) continue;

    let valorVista: number;
    try {
      valorVista = convert(rule.importe, rule.moneda, viewCurrency, rates);
    } catch {
      continue;
    }

    for (const fecha of occurrencesForRule(rule, anio, mes)) {
      if (fecha.getTime() <= nowMs) continue;
      const key = `${rule.id}:${fecha.getUTCFullYear()}-${fecha.getUTCMonth() + 1}-${fecha.getUTCDate()}`;
      (out[rule.categoriaId] ??= []).push({
        id: key,
        concepto: rule.nombre,
        fecha,
        importe: rule.importe,
        moneda: rule.moneda,
        valorVista,
      });
    }
  }

  for (const list of Object.values(out)) {
    list.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }
  return out;
}

// ============================================================================
//  COMPARATIVAS (pagina Evolucion, solo PC)
// ============================================================================

/** Metrica comparable mes a mes / año a año. */
export type MetricKey = "ingresos" | "gastos" | "ahorro";

/** Una fila por mes (1..12) con el valor de la metrica para cada año pedido. */
export type YearComparisonRow = {
  mes: number; // 1..12
  /** año -> valor de la metrica en ese mes (moneda vista). */
  values: Record<number, number>;
};

/**
 * Compara una metrica (ingresos/gastos/ahorro) mes a mes entre varios años.
 * Devuelve 12 filas (enero..diciembre); cada una lleva el valor de la metrica
 * de cada año. Reutiliza summarizeMonth, asi que la definicion de gasto neto,
 * ingresos y ahorro es identica al resto de la app.
 */
export function compareYearsByMonth(
  movements: Movement[],
  years: number[],
  metric: MetricKey,
  rates: RatesMap,
  viewCurrency: string,
): YearComparisonRow[] {
  const rows: YearComparisonRow[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const values: Record<number, number> = {};
    for (const anio of years) {
      const s = summarizeMonth({ mes, anio, movements, rates, viewCurrency });
      values[anio] = s[metric];
    }
    rows.push({ mes, values });
  }
  return rows;
}

/** Total anual de una metrica (suma de los 12 meses) para cada año. */
export function totalsByYear(
  rows: YearComparisonRow[],
  years: number[],
): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const anio of years) {
    let sum = 0;
    for (const row of rows) sum += row.values[anio] ?? 0;
    totals[anio] = sum;
  }
  return totals;
}

/** Una fila por periodo con el gasto neto de cada categoria pedida. */
export type CategoryMonthlyRow = {
  anio: number;
  mes: number;
  /** categoriaId -> gasto neto (moneda vista) en ese periodo. */
  values: Record<string, number>;
};

/**
 * Serie mensual de GASTO NETO por categoria. Para cada periodo pedido calcula
 * el gasto neto (devoluciones ya restadas, via sumMovementsByCategory) de cada
 * categoria de `categoriaIds`. Las categorias sin gasto ese mes salen a 0.
 */
export function categorySeriesByMonth(
  movements: Movement[],
  categoriaIds: string[],
  periods: Array<{ anio: number; mes: number }>,
  rates: RatesMap,
  viewCurrency: string,
): CategoryMonthlyRow[] {
  return periods.map(({ anio, mes }) => {
    const movsMes = filterMovementsByPeriod(movements, mes, anio);
    const porCat = sumMovementsByCategory(movsMes, rates, viewCurrency);
    const values: Record<string, number> = {};
    for (const id of categoriaIds) {
      values[id] = porCat[id] ?? 0;
    }
    return { anio, mes, values };
  });
}

/**
 * Suma de gastos por categoria, en moneda vista.
 */
export function sumMovementsByCategory(
  movements: Movement[],
  rates: RatesMap,
  viewCurrency: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of movements) {
    const esGasto = TIPOS_GASTO.has(m.tipo);
    const esDevolucion = m.tipo === TIPO_DEVOLUCION;
    if (!esGasto && !esDevolucion) continue;
    if (!m.categoriaId) continue;
    let value = 0;
    try {
      value = convert(m.importe, m.moneda, viewCurrency, rates);
    } catch {
      continue;
    }
    // La devolucion reembolsa parte del gasto de la categoria: resta del neto.
    result[m.categoriaId] =
      (result[m.categoriaId] ?? 0) + (esDevolucion ? -value : value);
  }
  return result;
}
