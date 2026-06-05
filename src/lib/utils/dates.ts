/**
 * ============================================================================
 *  src/lib/utils/dates.ts — Helpers de fechas (date-only)
 * ============================================================================
 *
 *  La app trabaja con fechas SIN HORA (un gasto pertenece a un dia, no a
 *  un instante). Esto evita problemas de zona horaria que aparecerian si
 *  guardaramos timestamps con hora.
 *
 *  CONVENCION:
 *    - En BD las guardamos como integer (timestamp ms en UTC) con la hora
 *      siempre a 00:00:00 UTC.
 *    - Al leer/escribir en formularios, usamos siempre la zona LOCAL del
 *      usuario (no UTC), porque "15 de enero" para el usuario debe ser
 *      el 15 de enero, no el 14.
 *
 *  Las funciones de este modulo encapsulan esa logica.
 * ============================================================================
 */

/**
 * Convierte una fecha (Date o number ms) a "fecha pura" — es decir, un
 * Date con la hora puesta a 00:00:00 EN ZONA LOCAL.
 *
 * Util para guardar en BD: aseguramos que dos gastos del "mismo dia"
 * tengan exactamente el mismo timestamp aunque se introdujeran a horas
 * distintas.
 */
export function toDateOnly(input: Date | number): Date {
  const d = typeof input === "number" ? new Date(input) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Normaliza una fecha LOCAL a "mediodia UTC del mismo dia visible".
 *
 * Si el usuario ve "1 mayo 2026" en un <Calendar>:
 *   - El Date local puede ser "1 mayo 00:00 SGT" (en Singapur, UTC+8)
 *   - Eso en UTC seria "30 abril 16:00 UTC"  <-- problematico: cualquier
 *     lectura con getUTCMonth() interpreta abril.
 *
 * Esta funcion lo convierte a "1 mayo 12:00 UTC", que es el mismo dia
 * sin importar la zona horaria del usuario (robusto para offsets +-12h).
 *
 * Usar SIEMPRE al enviar al backend una fecha proveniente de un calendario;
 * en el form sigue mostrandose el dia que selecciono el usuario.
 */
export function normalizeDateToUTCNoon(d: Date): Date {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0),
  );
}

/**
 * Extrae { mes, anio } de una fecha. Mes 1-indexado (enero = 1).
 * Usa la zona LOCAL del usuario (no UTC).
 */
export function extractPeriod(date: Date): { mes: number; anio: number } {
  return {
    mes: date.getMonth() + 1,
    anio: date.getFullYear(),
  };
}

/**
 * Convierte un valor de un input HTML <input type="date"> (formato
 * "YYYY-MM-DD") a un Date en zona local con hora 00:00:00.
 *
 * IMPORTANTE: `new Date("2026-01-15")` se interpreta como UTC, no como
 * local. Eso causa que en horarios al oeste de UTC la fecha se "desplace"
 * al dia anterior. Esta funcion evita ese bug parseando los componentes
 * a mano.
 */
export function parseDateOnlyString(value: string): Date {
  // value tiene formato 'YYYY-MM-DD'
  const parts = value.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`parseDateOnlyString: formato invalido '${value}'`);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Formatea un Date como 'YYYY-MM-DD', util para rellenar inputs nativos.
 */
export function formatDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Nombres de mes en espanol. Util para selectores y tablas.
 */
export const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const MESES_ES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/**
 * Clave comparable mes/anio: anio*100 + mes (mes 1-12). Util para comparar
 * periodos sin construir Dates. Ej: junio 2026 -> 202606.
 */
export function periodKey(anio: number, mes: number): number {
  return anio * 100 + mes;
}

/**
 * Formatea una fecha como "15 ene 2026" o "15 enero 2026" segun el flag.
 */
export function formatDateLong(date: Date, abbrev = true): string {
  const meses = abbrev ? MESES_ES_CORTO : MESES_ES;
  const dia = date.getDate();
  const mes = meses[date.getMonth()];
  const anio = date.getFullYear();
  return `${dia} ${mes} ${anio}`;
}
