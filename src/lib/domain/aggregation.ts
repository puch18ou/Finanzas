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

import type { Movement } from "@/lib/db/schema";
import { convert, type RatesMap } from "./currency";
import { costeReal, sumRefundsInCurrency } from "./refunds";

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
