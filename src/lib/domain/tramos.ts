/**
 * ============================================================================
 *  src/lib/domain/tramos.ts — Valores con vigencia (tramos)
 * ============================================================================
 *
 *  Patron "effective-dated": en vez de un valor unico, se guarda una lista de
 *  tramos `{ desde (mes/anio) -> valor }`. Para un mes M, el valor vigente es
 *  el del tramo con mayor `desde` <= M (piecewise-constant: el valor se
 *  arrastra hasta el siguiente cambio).
 *
 *  CONVENCION DE LA FECHA "DESDE"
 *    - desdeAnio + desdeMes = primer mes en que aplica el tramo.
 *    - desdeAnio = null y desdeMes = null = tramo BASE "desde siempre"
 *      (cuenta como -infinito; cubre todo hasta el siguiente tramo).
 * ============================================================================
 */

export type ConVigencia = {
  desdeAnio: number | null;
  desdeMes: number | null;
};

/** Clave comparable de un tramo: anio*100+mes, o -1 si es base ("siempre"). */
function tramoKey(t: ConVigencia): number {
  if (t.desdeAnio == null || t.desdeMes == null) return -1;
  return t.desdeAnio * 100 + t.desdeMes;
}

/**
 * Devuelve el tramo vigente para (anio, mes): el de mayor `desde` <= (anio,mes).
 * Null si ningun tramo aplica todavia (todos arrancan despues de ese mes).
 */
export function resolveTramo<T extends ConVigencia>(
  tramos: T[],
  anio: number,
  mes: number,
): T | null {
  const target = anio * 100 + mes;
  let best: T | null = null;
  let bestKey = -Infinity;
  for (const t of tramos) {
    const key = tramoKey(t);
    if (key <= target && key > bestKey) {
      best = t;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Fecha "ancla" de una linea temporal, para las vistas acumuladas (Evolucion
 * "desde objetivo", acumulado de Presupuestos/Dashboard):
 *   - Si algun tramo es base ("desde siempre") -> null (sin ancla concreta,
 *     equivale al comportamiento previo sin fecha desde).
 *   - Si no, el primer mes con tramo (el `desde` mas antiguo).
 *   - Lista vacia -> null.
 */
export function tramosAncla<T extends ConVigencia>(
  tramos: T[],
): { anio: number; mes: number } | null {
  if (tramos.length === 0) return null;
  let min: number | null = null;
  for (const t of tramos) {
    const key = tramoKey(t);
    if (key === -1) return null; // hay base "siempre" => sin ancla concreta
    if (min == null || key < min) min = key;
  }
  if (min == null) return null;
  return { anio: Math.floor(min / 100), mes: min % 100 };
}

/** Ordena tramos por fecha ascendente, con el base ("siempre") primero. */
export function ordenarTramos<T extends ConVigencia>(tramos: T[]): T[] {
  return [...tramos].sort((a, b) => tramoKey(a) - tramoKey(b));
}

/**
 * Presupuesto de categoria con modelo HIBRIDO: el valor base ("desde siempre")
 * vive en la propia categoria (categories.presupuestoMensual/Moneda) y los
 * `tramos` son solo cambios CON FECHA. Para (anio, mes) devuelve el tramo con
 * fecha mas reciente <= mes, o el base si ninguno aplica todavia.
 *
 * `tramos` debe ser la lista de UNA categoria.
 */
export function resolvePresupuesto<
  T extends ConVigencia & { importe: number; moneda: string },
>(
  tramos: T[],
  baseImporte: number,
  baseMoneda: string,
  anio: number,
  mes: number,
): { importe: number; moneda: string } {
  const tr = resolveTramo(tramos, anio, mes);
  if (tr) return { importe: tr.importe, moneda: tr.moneda };
  return { importe: baseImporte, moneda: baseMoneda };
}
