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

/**
 * Dadas la fecha de inicio/fin de una regla MENSUAL y un diaDelMes,
 * devuelve las proximas ocurrencias previstas en el horizonte
 * [now, now + daysAhead]. No incluye ocurrencias ya pasadas: solo
 * las futuras (fecha > now).
 *
 * Esto se usa para exponer en la UI los movimientos recurrentes que
 * AUN no se han generado (se generaran al llegar el dia).
 */
export function computeUpcomingFromRule(
  rule: {
    diaDelMes: number;
    fechaInicio: Date;
    fechaFin: Date | null;
  },
  now: Date,
  daysAhead: number,
): Array<{ fecha: Date; anio: number; mes: number }> {
  const startDate =
    rule.fechaInicio instanceof Date
      ? rule.fechaInicio
      : new Date(rule.fechaInicio);
  const endDate = rule.fechaFin
    ? rule.fechaFin instanceof Date
      ? rule.fechaFin
      : new Date(rule.fechaFin)
    : null;

  const horizonTs = now.getTime() + daysAhead * 24 * 3600 * 1000;
  const nowTs = now.getTime();

  // Empezamos por el periodo actual y avanzamos mes a mes hasta superar
  // el horizonte (max 6 iteraciones por seguridad, ~6 meses).
  const result: Array<{ fecha: Date; anio: number; mes: number }> = [];
  let { anio, mes } = currentPeriod(now);
  for (let i = 0; i < 6; i++) {
    if (isPeriodInRange(anio, mes, startDate, endDate)) {
      const fecha = buildPeriodDate(rule.diaDelMes, anio, mes);
      const ts = fecha.getTime();
      if (ts > nowTs && ts <= horizonTs) {
        result.push({ fecha, anio, mes });
      } else if (ts > horizonTs) {
        break;
      }
    }
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }
  return result;
}
