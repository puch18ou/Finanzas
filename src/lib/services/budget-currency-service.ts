/**
 * ============================================================================
 *  src/lib/services/budget-currency-service.ts
 * ============================================================================
 *
 *  Convierte los presupuestos EXISTENTES a la moneda local, al tipo de cambio.
 *
 *  Contexto: los presupuestos se guardan en `categories.presupuestoMoneda` (y
 *  los cambios con fecha en `presupuesto_tramos.moneda`). Si el usuario tenia
 *  la moneda local en SGD (valor de fabrica) y la cambia a EUR, sus
 *  presupuestos siguen en SGD. Esta operacion los pasa a la moneda local
 *  CONVIRTIENDO el importe (p.ej. 600 SGD -> ~414 EUR), para que el presupuesto
 *  valga lo mismo, no solo cambie la etiqueta.
 *
 *  La parte de calculo (`planBudgetConversion`) es pura y testeable; el
 *  aplicador persiste via repos.
 * ============================================================================
 */

import type { Repositories } from "@/lib/repositories";
import { convert, type RatesMap } from "@/lib/domain/currency";

/** Redondeo a 2 decimales (importes monetarios). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BudgetConversionPlan {
  /** Categorias cuyo presupuesto base hay que convertir. */
  categorias: Array<{ id: string; nuevoImporte: number }>;
  /** Tramos (cambios con fecha) cuyo importe hay que convertir. */
  tramos: Array<{ id: string; nuevoImporte: number }>;
}

/**
 * Calcula (SIN tocar la BD) que presupuestos hay que convertir a `monedaLocal`.
 * Solo entran los que estan en OTRA moneda; los que ya estan en la local se
 * dejan igual (asi la operacion es idempotente: repetirla no hace nada).
 */
export function planBudgetConversion(
  categorias: Array<{
    id: string;
    presupuestoMensual: number;
    presupuestoMoneda: string;
  }>,
  tramos: Array<{ id: string; importe: number; moneda: string }>,
  monedaLocal: string,
  rates: RatesMap,
): BudgetConversionPlan {
  return {
    categorias: categorias
      .filter((c) => c.presupuestoMoneda !== monedaLocal)
      .map((c) => ({
        id: c.id,
        nuevoImporte: round2(
          convert(c.presupuestoMensual, c.presupuestoMoneda, monedaLocal, rates),
        ),
      })),
    tramos: tramos
      .filter((t) => t.moneda !== monedaLocal)
      .map((t) => ({
        id: t.id,
        nuevoImporte: round2(convert(t.importe, t.moneda, monedaLocal, rates)),
      })),
  };
}

/**
 * Convierte TODOS los presupuestos (categorias + tramos) a la moneda local al
 * tipo de cambio. Devuelve cuantos elementos se convirtieron (0 = ya estaba
 * todo en la moneda local).
 */
export async function convertBudgetsToLocal(
  repos: Repositories,
  monedaLocal: string,
  rates: RatesMap,
): Promise<number> {
  const [categorias, tramos] = await Promise.all([
    repos.categories.list(),
    repos.presupuestoTramos.list(),
  ]);

  const plan = planBudgetConversion(categorias, tramos, monedaLocal, rates);

  for (const c of plan.categorias) {
    await repos.categories.update(c.id, {
      presupuestoMensual: c.nuevoImporte,
      presupuestoMoneda: monedaLocal,
    });
  }
  for (const t of plan.tramos) {
    await repos.presupuestoTramos.update(t.id, {
      importe: t.nuevoImporte,
      moneda: monedaLocal,
    });
  }

  return plan.categorias.length + plan.tramos.length;
}
