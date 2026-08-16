/**
 * ============================================================================
 *  src/lib/domain/refunds.ts — Devoluciones asociadas a un gasto
 * ============================================================================
 *
 *  Una devolucion (movimiento tipo 'devolucion') puede vincularse al GASTO que
 *  reembolsa via `gastoAsociadoId`. Con eso calculamos el COSTE REAL del gasto:
 *  lo que de verdad te costo tras descontar lo que te devolvieron.
 *
 *  La devolucion puede estar en OTRA moneda que el gasto (te devuelven en otra
 *  divisa), asi que al sumar convertimos cada devolucion a la moneda del gasto
 *  con el tipo de cambio.
 * ============================================================================
 */

import { convert, type RatesMap } from "@/lib/domain/currency";

/**
 * Suma las devoluciones expresada en `targetMoneda` (la del gasto), convirtiendo
 * cada una desde su propia moneda con el tipo de cambio.
 */
export function sumRefundsInCurrency(
  refunds: Array<{ importe: number; moneda: string }>,
  targetMoneda: string,
  rates: RatesMap,
): number {
  let total = 0;
  for (const r of refunds) {
    total += convert(r.importe, r.moneda, targetMoneda, rates);
  }
  return total;
}

/**
 * Coste real de un gasto = importe - total devuelto (ya en la moneda del gasto).
 * Nunca baja de 0 (si te devolvieran mas de lo que costo, el coste real es 0).
 */
export function costeReal(importeGasto: number, totalDevuelto: number): number {
  return Math.max(0, importeGasto - totalDevuelto);
}

/** ¿Este gasto tiene alguna devolucion asociada? */
export function tieneDevoluciones(totalDevuelto: number): boolean {
  return totalDevuelto > 0;
}
