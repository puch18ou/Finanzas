/**
 * ============================================================================
 *  src/lib/domain/recurring.ts — utilidades puras para reglas recurrentes
 * ============================================================================
 *
 *  Funciones de fecha sin dependencias de DB. Se testean facil en aislamiento.
 * ============================================================================
 */

/**
 * Devuelve el ultimo dia del mes (1-31).
 */
export function lastDayOfMonth(anio: number, mes: number): number {
  // new Date(anio, mes, 0) devuelve el dia 0 del mes siguiente,
  // que es el ultimo dia del mes actual.
  return new Date(anio, mes, 0).getDate();
}

/**
 * Clamp del dia al ultimo del mes si no existe.
 *
 * Ejemplos:
 *   clampDayToMonth(31, 2026, 2) = 28 (febrero 2026)
 *   clampDayToMonth(31, 2024, 2) = 29 (febrero 2024 bisiesto)
 *   clampDayToMonth(31, 2026, 4) = 30 (abril)
 *   clampDayToMonth(15, 2026, 6) = 15
 */
export function clampDayToMonth(dia: number, anio: number, mes: number): number {
  const last = lastDayOfMonth(anio, mes);
  return Math.min(dia, last);
}

/**
 * Construye la fecha para un periodo (anio, mes) usando el diaDelMes de
 * una regla, con clamp.
 *
 * El movement generado tendra esta fecha. La hora se fija a las 12:00:00
 * UTC para evitar problemas con zonas horarias.
 */
export function buildPeriodDate(diaDelMes: number, anio: number, mes: number): Date {
  const dia = clampDayToMonth(diaDelMes, anio, mes);
  // mes es 1-12 aqui; new Date espera 0-11
  return new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0, 0));
}

/**
 * Indica si un periodo (anio, mes) cae DENTRO del intervalo de aplicacion
 * de una regla [fechaInicio, fechaFin].
 *
 * - fechaInicio: el periodo del mes de fechaInicio cuenta como incluido.
 * - fechaFin: si es null, regla indefinida. Si esta presente, el periodo
 *             del mes de fechaFin tambien cuenta como incluido (inclusive).
 */
export function isPeriodInRange(
  anio: number,
  mes: number,
  fechaInicio: Date,
  fechaFin: Date | null,
): boolean {
  const periodTs = anioMesToComparableNumber(anio, mes);
  const startTs = anioMesToComparableNumber(
    fechaInicio.getUTCFullYear(),
    fechaInicio.getUTCMonth() + 1,
  );
  if (periodTs < startTs) return false;

  if (fechaFin) {
    const endTs = anioMesToComparableNumber(
      fechaFin.getUTCFullYear(),
      fechaFin.getUTCMonth() + 1,
    );
    if (periodTs > endTs) return false;
  }

  return true;
}

/**
 * Convierte (anio, mes) en un numero comparable. Util para comparar
 * periodos sin lidiar con tipos Date.
 *
 * Ejemplo: (2026, 5) -> 202605
 */
export function anioMesToComparableNumber(anio: number, mes: number): number {
  return anio * 100 + mes;
}

/**
 * Devuelve la lista de periodos (anio, mes) entre dos limites, inclusive
 * en ambos extremos.
 *
 * Ejemplo: periodsBetween(2026, 1, 2026, 4) =
 *   [{anio:2026,mes:1}, {anio:2026,mes:2}, {anio:2026,mes:3}, {anio:2026,mes:4}]
 */
export function periodsBetween(
  anioStart: number,
  mesStart: number,
  anioEnd: number,
  mesEnd: number,
): Array<{ anio: number; mes: number }> {
  const result: Array<{ anio: number; mes: number }> = [];
  let a = anioStart;
  let m = mesStart;
  const endNum = anioMesToComparableNumber(anioEnd, mesEnd);

  while (anioMesToComparableNumber(a, m) <= endNum) {
    result.push({ anio: a, mes: m });
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
    // Salvaguarda para evitar bucle infinito si los parametros son raros.
    if (result.length > 10_000) break;
  }
  return result;
}

/**
 * Devuelve el periodo actual {anio, mes} segun la fecha del sistema.
 */
export function currentPeriod(now: Date = new Date()): { anio: number; mes: number } {
  return {
    anio: now.getFullYear(),
    mes: now.getMonth() + 1,
  };
}

// ============================================================================
//  PERIODICIDAD FLEXIBLE (migracion 0032) — occurrencesForRule
// ============================================================================

/** Frecuencias soportadas por el motor general de reglas recurrentes. */
export type RecurringFrecuencia =
  | "diaria"
  | "semanal"
  | "mensual"
  | "anual"
  | "varios-mes";

/**
 * Campos de una regla necesarios para calcular sus ocurrencias en un mes.
 * Es un subconjunto de RecurringRule para poder testear sin la DB.
 */
export interface OccurrenceRule {
  frecuencia?: RecurringFrecuencia | null;
  diaDelMes: number;
  diaSemana?: number | null;
  diasDelMes?: string | null; // "1,15"
  mesDelAnio?: number | null; // 1-12
  fechaInicio: Date | number | string;
  fechaFin: Date | number | string | null;
}

function coerceDate(d: Date | number | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/**
 * Parsea la lista "1,15,28" -> [1, 15, 28]. Descarta valores no validos
 * (fuera de 1-31 o no numericos). No ordena ni deduplica (eso lo hace
 * occurrencesForRule tras el clamp mensual).
 */
export function parseDiasDelMes(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
}

/**
 * Comprueba si una fecha concreta (mediodia UTC) cae dentro del rango de la
 * regla comparando a nivel de DIA (ignora la hora de fechaInicio/fechaFin).
 * Se usa para diaria/semanal, donde el limite de dia importa.
 */
function dayInRange(date: Date, start: Date, end: Date | null): boolean {
  const ts = date.getTime();
  const startTs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    12,
  );
  if (ts < startTs) return false;
  if (end) {
    const endTs = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      12,
    );
    if (ts > endTs) return false;
  }
  return true;
}

/**
 * Devuelve TODAS las fechas (mediodia UTC) en las que una regla ocurre dentro
 * de un mes/anio concreto, segun su frecuencia. Array vacio si el mes cae
 * fuera del rango [fechaInicio, fechaFin] o si la frecuencia no aplica ese mes
 * (p.ej. anual en un mes distinto al configurado).
 *
 * - mensual / anual / varios-mes: se filtran a nivel de MES (isPeriodInRange),
 *   conservando la semantica clasica (fechaInicio como ancla de mes).
 * - diaria / semanal: ademas se filtra cada dia candidato a nivel de DIA
 *   contra fechaInicio/fechaFin.
 *
 * Reemplaza conceptualmente a monthlyOccurrenceFor generalizando a N fechas.
 */
export function occurrencesForRule(
  rule: OccurrenceRule,
  anio: number,
  mes: number,
): Date[] {
  const start = coerceDate(rule.fechaInicio);
  const end = rule.fechaFin != null ? coerceDate(rule.fechaFin) : null;
  const freq: RecurringFrecuencia = rule.frecuencia ?? "mensual";

  // Puerta a nivel de mes (igual que el motor mensual clasico).
  if (!isPeriodInRange(anio, mes, start, end)) return [];

  switch (freq) {
    case "mensual":
      return [buildPeriodDate(rule.diaDelMes, anio, mes)];

    case "anual": {
      const targetMonth = rule.mesDelAnio ?? start.getUTCMonth() + 1;
      if (mes !== targetMonth) return [];
      return [buildPeriodDate(rule.diaDelMes, anio, mes)];
    }

    case "varios-mes": {
      const dias = parseDiasDelMes(rule.diasDelMes);
      const use = dias.length > 0 ? dias : [rule.diaDelMes];
      // Deduplicamos tras el clamp: p.ej. dias 30 y 31 colapsan en febrero.
      const seen = new Set<number>();
      const out: Date[] = [];
      for (const d of use) {
        const day = clampDayToMonth(d, anio, mes);
        if (seen.has(day)) continue;
        seen.add(day);
        out.push(buildPeriodDate(d, anio, mes));
      }
      out.sort((a, b) => a.getTime() - b.getTime());
      return out;
    }

    case "semanal": {
      const target = rule.diaSemana ?? start.getUTCDay();
      const last = lastDayOfMonth(anio, mes);
      const out: Date[] = [];
      for (let d = 1; d <= last; d++) {
        const date = new Date(Date.UTC(anio, mes - 1, d, 12, 0, 0, 0));
        if (date.getUTCDay() !== target) continue;
        if (dayInRange(date, start, end)) out.push(date);
      }
      return out;
    }

    case "diaria": {
      const last = lastDayOfMonth(anio, mes);
      const out: Date[] = [];
      for (let d = 1; d <= last; d++) {
        const date = new Date(Date.UTC(anio, mes - 1, d, 12, 0, 0, 0));
        if (dayInRange(date, start, end)) out.push(date);
      }
      return out;
    }

    default:
      return [buildPeriodDate(rule.diaDelMes, anio, mes)];
  }
}

/**
 * Devuelve la fecha de la ocurrencia mensual de una regla en un mes/anio
 * concreto, o null si ese periodo cae fuera del rango de la regla
 * [fechaInicio, fechaFin].
 *
 * Util para mostrar "previstos" mes a mes en evolucion/dashboard sin
 * depender de un horizonte temporal.
 */
export function monthlyOccurrenceFor(
  rule: {
    diaDelMes: number;
    fechaInicio: Date;
    fechaFin: Date | null;
  },
  anio: number,
  mes: number,
): Date | null {
  const startDate =
    rule.fechaInicio instanceof Date
      ? rule.fechaInicio
      : new Date(rule.fechaInicio);
  const endDate = rule.fechaFin
    ? rule.fechaFin instanceof Date
      ? rule.fechaFin
      : new Date(rule.fechaFin)
    : null;
  if (!isPeriodInRange(anio, mes, startDate, endDate)) return null;
  return buildPeriodDate(rule.diaDelMes, anio, mes);
}

/**
 * Devuelve las proximas ocurrencias previstas de una regla en el horizonte
 * (now, now + daysAhead]. No incluye ocurrencias ya pasadas: solo las futuras
 * (fecha > now). Soporta TODAS las frecuencias via occurrencesForRule.
 *
 * Esto se usa para exponer en la UI los movimientos recurrentes que AUN no se
 * han generado (se generaran al llegar el dia).
 */
export function computeUpcomingFromRule(
  rule: OccurrenceRule,
  now: Date,
  daysAhead: number,
): Array<{ fecha: Date; anio: number; mes: number }> {
  const nowTs = now.getTime();
  const horizonTs = nowTs + daysAhead * 24 * 3600 * 1000;
  const horizon = new Date(horizonTs);

  const startP = currentPeriod(now);
  const endP = currentPeriod(horizon);
  const periods = periodsBetween(startP.anio, startP.mes, endP.anio, endP.mes);

  const result: Array<{ fecha: Date; anio: number; mes: number }> = [];
  for (const { anio, mes } of periods) {
    for (const fecha of occurrencesForRule(rule, anio, mes)) {
      const ts = fecha.getTime();
      if (ts > nowTs && ts <= horizonTs) {
        result.push({ fecha, anio, mes });
      }
    }
  }
  result.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  return result;
}
