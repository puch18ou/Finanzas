/**
 * ============================================================================
 *  src/lib/domain/alerts.ts — Avisos automaticos (insight A)
 * ============================================================================
 *
 *  Genera avisos accionables a partir de los datos que ya tiene la app. De
 *  momento: presupuestos por categoria (te has pasado / casi te pasas). Pensado
 *  para crecer (ritmo de gasto, saldo en rojo, etc.).
 *
 *  Funciones puras: reciben datos ya calculados, devuelven avisos estructurados
 *  (sin formatear importes; eso lo hace la UI con la moneda vista).
 * ============================================================================
 */

export type BudgetInput = {
  categoriaId: string;
  nombre: string;
  gastado: number;
  presupuesto: number;
};

export type BudgetAlert = {
  categoriaId: string;
  nombre: string;
  gastado: number;
  presupuesto: number;
  /** gastado / presupuesto (1 = justo en el limite). */
  ratio: number;
  /** "high" = pasado del presupuesto; "warn" = cerca de agotarlo. */
  severity: "high" | "warn";
};

/**
 * Avisos de presupuesto: por cada categoria con presupuesto > 0, avisa si se
 * paso (ratio > 1) o si esta cerca de agotarlo (ratio >= nearPct). Ordenados de
 * mayor a menor exceso (los pasados primero, porque su ratio > 1).
 */
export function computeBudgetAlerts(
  rows: BudgetInput[],
  nearPct = 0.8,
): BudgetAlert[] {
  const out: BudgetAlert[] = [];
  for (const r of rows) {
    if (r.presupuesto <= 0) continue;
    const ratio = r.gastado / r.presupuesto;
    if (ratio > 1) {
      out.push({ ...r, ratio, severity: "high" });
    } else if (ratio >= nearPct) {
      out.push({ ...r, ratio, severity: "warn" });
    }
  }
  out.sort((a, b) => b.ratio - a.ratio);
  return out;
}
