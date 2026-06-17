/**
 * ============================================================================
 *  src/lib/utils/dates.ts — Helpers de fechas (date-only)
 * ============================================================================
 *
 *  La app trabaja con fechas SIN HORA (un gasto pertenece a un dia, no a
 *  un instante). Esto evita problemas de zona horaria que aparecerian si
 *  guardaramos timestamps con hora.
 *
 *  CONVENCION (importante para viajar entre zonas horarias):
 *    - Una FECHA CIVIL (la fecha de un gasto, el inicio de una regla, la
 *      fecha objetivo de una meta...) representa UN DIA DEL CALENDARIO, sin
 *      hora. En BD se guarda como integer (timestamp ms) fijado a las
 *      12:00:00 UTC (MEDIODIA) del dia visible. Mediodia UTC es robusto:
 *      +-12h de offset no cambian el dia, asi que leer sus componentes con
 *      getUTC* devuelve SIEMPRE el dia que eligio el usuario, viaje donde
 *      viaje. => Toda fecha civil se LEE con getUTC* (ver extractPeriod /
 *      formatDateLong).
 *    - El "AHORA" / mes actual NO es una fecha civil guardada: es un
 *      instante. Se lee con getters LOCALES (new Date().getMonth()...),
 *      porque te importa el calendario del sitio donde estas fisicamente
 *      (si en Singapur ya es 1 de junio, tu mes actual es junio aunque en
 *      UTC siga siendo 31 de mayo).
 *    - Los campos de auditoria/sync (createdAt, updatedAt, deletedAt) son
 *      instantes; para MOSTRARLOS usa formatInstantLong (zona local).
 *
 *  Las funciones de este modulo encapsulan esa logica.
 * ============================================================================
 */

/**
 * @deprecated Usa `normalizeDateToUTCNoon`. Se mantiene por compatibilidad y
 * ahora delega en ella (mediodia UTC) para no romper la convencion de fecha
 * civil. Antes fijaba 00:00 en zona LOCAL, lo que desplazaba el dia al
 * guardar/leer en zonas horarias alejadas de UTC.
 */
export function toDateOnly(input: Date | number): Date {
  return normalizeDateToUTCNoon(typeof input === "number" ? new Date(input) : input);
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
  // IDEMPOTENTE: si la fecha YA es una fecha civil (mediodia UTC exacto), la
  // devolvemos sin tocar. Asi se puede normalizar varias veces sin desplazar el
  // dia (p.ej. al elegir en el <Calendar> y de nuevo al guardar). Sin esta
  // guarda, en zonas al ESTE de UTC+12 (UTC+13/+14) mediodia UTC se lee como el
  // dia siguiente en local y cada pasada con getters locales sumaria +1 dia.
  if (
    d.getUTCHours() === 12 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return new Date(d.getTime());
  }
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0),
  );
}

/**
 * Extrae { mes, anio } de una FECHA CIVIL guardada. Mes 1-indexado (enero = 1).
 *
 * Lee con getUTC* porque las fechas civiles se guardan a mediodia UTC: asi el
 * periodo no se desplaza aunque el dispositivo este en otra zona horaria.
 *
 * NOTA: para el "mes actual" NO uses esto sobre `new Date()` directamente
 * (eso es un instante, no una fecha civil). El mes en que estas fisicamente
 * se obtiene con getters LOCALES (ver currentPeriod en domain/recurring).
 */
export function extractPeriod(date: Date): { mes: number; anio: number } {
  return {
    mes: date.getUTCMonth() + 1,
    anio: date.getUTCFullYear(),
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
 * Formatea una FECHA CIVIL guardada como "15 ene 2026" o "15 enero 2026".
 *
 * Lee con getUTC* (las fechas civiles se guardan a mediodia UTC), de modo que
 * el dia mostrado no se desplaza al viajar a otra zona horaria.
 *
 * Para mostrar un INSTANTE (createdAt/updatedAt/deletedAt) usa
 * `formatInstantLong`, que respeta la zona local.
 */
export function formatDateLong(date: Date, abbrev = true): string {
  const meses = abbrev ? MESES_ES_CORTO : MESES_ES;
  const dia = date.getUTCDate();
  const mes = meses[date.getUTCMonth()];
  const anio = date.getUTCFullYear();
  return `${dia} ${mes} ${anio}`;
}

/**
 * Formatea un INSTANTE (timestamp de auditoria/sync: createdAt, updatedAt,
 * deletedAt) como "15 ene 2026" en la zona LOCAL del usuario. A diferencia de
 * formatDateLong, aqui SI queremos la hora local: "borrado el 15 de enero"
 * debe referirse al dia local en que ocurrio.
 */
export function formatInstantLong(date: Date, abbrev = true): string {
  const meses = abbrev ? MESES_ES_CORTO : MESES_ES;
  const dia = date.getDate();
  const mes = meses[date.getMonth()];
  const anio = date.getFullYear();
  return `${dia} ${mes} ${anio}`;
}
