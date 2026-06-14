/**
 * ============================================================================
 *  src/lib/utils/staleness.ts — "Hace cuanto" y frescura de datos
 * ============================================================================
 *
 *  Helpers para mostrar la antiguedad de datos automaticos (cotizaciones,
 *  tipos de cambio, ultima sincronizacion) y avisar cuando estan viejos. Los
 *  proveedores externos (Yahoo, BCE) fallan en silencio; esto lo hace visible.
 *
 *  `date` es un INSTANTE (cuando se actualizo por ultima vez), asi que la
 *  antiguedad se mide contra el "ahora" del reloj local.
 * ============================================================================
 */

export type StalenessLevel = "fresh" | "warn" | "stale" | "never";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Antiguedad en dias enteros, o null si nunca. */
export function daysSince(date: Date | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const ms = now.getTime() - date.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / DAY);
}

/**
 * Texto "hace cuanto" en espanol: "nunca", "ahora mismo", "hace 3 h",
 * "hoy"/"ayer", "hace 4 dias", "hace 2 semanas", "hace 3 meses".
 */
export function timeAgo(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "nunca";
  const ms = now.getTime() - date.getTime();
  if (ms < MIN) return "ahora mismo";
  if (ms < HOUR) return `hace ${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `hace ${Math.floor(ms / HOUR)} h`;

  const days = Math.floor(ms / DAY);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} dias`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} semana${weeks > 1 ? "s" : ""}`;

  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

/**
 * Nivel de frescura segun la antiguedad en dias:
 *   - null            -> "never"  (nunca se actualizo)
 *   - < warnDays      -> "fresh"
 *   - < staleDays     -> "warn"
 *   - >= staleDays    -> "stale"
 */
export function stalenessLevel(
  date: Date | null | undefined,
  opts: { warnDays: number; staleDays: number },
  now: Date = new Date(),
): StalenessLevel {
  const d = daysSince(date, now);
  if (d === null) return "never";
  if (d < opts.warnDays) return "fresh";
  if (d < opts.staleDays) return "warn";
  return "stale";
}
