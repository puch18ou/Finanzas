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
