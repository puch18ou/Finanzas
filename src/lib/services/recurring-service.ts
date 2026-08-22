/**
 * ============================================================================
 *  src/lib/services/recurring-service.ts
 * ============================================================================
 *
 *  Genera movements a partir de reglas recurrentes. Idempotente: se puede
 *  llamar las veces que haga falta sin duplicar movements.
 *
 *  USO TIPICO (en Lote 11b, al arrancar la app):
 *    const service = new RecurringService(db);
 *    await service.generatePendingUpToCurrentMonth();
 *
 *  La idempotencia se basa en que cada movement generado lleva:
 *    - origenAutomaticoId = regla.id
 *    - mes = X
 *    - anio = Y
 *  Si ya existe un movement con esos tres campos (y deletedAt IS NULL),
 *  no se crea otro.
 *
 *  TIPO 'recurring'
 *  ----------------
 *  Hay un caso especial. El schema de movements tiene origenAutomatico
 *  como enum con valores 'mortgage' | 'debt' | 'interest'. Reglas
 *  MANUALES (sin origen) no encajan en ese enum.
 *
 *  Solucion: para reglas manuales, dejamos origenAutomatico = NULL en el
 *  movement pero ponemos origenAutomaticoId = regla.id. La query de
 *  deteccion de duplicados usa SOLO origenAutomaticoId, asi que funciona.
 *
 *  Para reglas vinculadas (Lote 11c) se rellenara origenAutomatico con
 *  el valor adecuado.
 * ============================================================================
 */

import { and, eq, isNull, inArray } from "drizzle-orm";
import { autoGenId } from "@/lib/domain/auto-id";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { movements, recurringRules } from "@/lib/db/schema";
import type {
  Movement,
  NewMovement,
  RecurringRule,
} from "@/lib/db/schema";
import {
  anioMesToComparableNumber,
  currentPeriod,
  isPeriodInRange,
  occurrencesForRule,
  periodsBetween,
} from "@/lib/domain/recurring";

/**
 * Clave de idempotencia por FECHA (una regla puede tener varias ocurrencias
 * en el mismo mes: semanal/diaria/varios-mes). Es retrocompatible con las
 * reglas mensuales existentes: su `fecha` almacenada coincide con la que
 * devuelve occurrencesForRule, asi que la clave es la misma.
 */
function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/**
 * Las frecuencias con potencialmente varias ocurrencias por mes necesitan el
 * dia en el sufijo del ID determinista. Las de una sola ocurrencia por periodo
 * (mensual/anual) conservan el sufijo `anio-mes` HISTORICO para no cambiar el
 * PK de los movements ya generados (y evitar duplicados via sync al actualizar).
 */
function needsDayInId(frecuencia: RecurringRule["frecuencia"]): boolean {
  return (
    frecuencia === "diaria" ||
    frecuencia === "semanal" ||
    frecuencia === "varios-mes"
  );
}

export type RecurringGenerationResult = {
  generated: Movement[];
  skippedExisting: number;
  inactiveRulesSkipped: number;
};

export class RecurringService {
  constructor(private db: DrizzleDb) {}

  /**
   * Genera todos los movements pendientes desde fechaInicio (o desde el
   * mes mas antiguo sin generar) hasta el periodo actual del sistema.
   *
   * Lo que hace, paso a paso:
   *   1. Lista las reglas activas.
   *   2. Para cada regla, determina los periodos relevantes
   *      [fechaInicio, mes_actual] y filtra por fechaFin si aplica.
   *   3. Consulta los movements ya generados por esa regla.
   *   4. Crea los movements que falten.
   */
  async generatePendingUpToCurrentMonth(
    now: Date = new Date(),
  ): Promise<RecurringGenerationResult> {
    const { anio, mes } = currentPeriod(now);
    return this.generateUpTo(anio, mes, now);
  }

  /**
   * Como generatePendingUpToCurrentMonth pero permitiendo especificar
   * el periodo final (util para tests).
   *
   * IMPORTANTE: solo se generan movements cuya fecha (segun el diaDelMes
   * de la regla) sea <= `now`. Las ocurrencias futuras del mes actual NO
   * se materializan: se exponen aparte como "previstos" via
   * computeUpcomingFromRule() en domain/recurring.ts.
   */
  async generateUpTo(
    anioEnd: number,
    mesEnd: number,
    now: Date = new Date(),
  ): Promise<RecurringGenerationResult> {
    const allRules = await this.db.select().from(recurringRules).where(
      isNull(recurringRules.deletedAt),
    );

    // Las reglas de aportacion periodica a inversiones (origen 'investment')
    // NO se generan aqui: las genera InvestmentContributionService, que crea
    // ademas la fila de aportacion y recalcula los totales de la inversion.
    const relevantRules = allRules.filter(
      (r) => r.origenAutomatico !== "investment",
    );

    const activeRules = relevantRules.filter((r) => r.activa);
    const inactiveRulesSkipped = relevantRules.length - activeRules.length;

    const result: RecurringGenerationResult = {
      generated: [],
      skippedExisting: 0,
      inactiveRulesSkipped,
    };

    if (activeRules.length === 0) return result;

    // Para cada regla calculamos los movements que TOCARIA crear. Una regla
    // puede generar VARIAS ocurrencias en un mismo mes (semanal/diaria/
    // varios-mes), asi que cada candidato lleva su fecha concreta.
    const toInsertCandidates: Array<{
      rule: RecurringRule;
      fecha: Date;
      anio: number;
      mes: number;
    }> = [];

    for (const rule of activeRules) {
      const startDate =
        rule.fechaInicio instanceof Date
          ? rule.fechaInicio
          : new Date(rule.fechaInicio);

      const startAnio = startDate.getUTCFullYear();
      const startMes = startDate.getUTCMonth() + 1;

      // Si el inicio de la regla es DESPUES del periodo final, saltamos.
      if (
        anioMesToComparableNumber(startAnio, startMes) >
        anioMesToComparableNumber(anioEnd, mesEnd)
      ) {
        continue;
      }

      const periodos = periodsBetween(startAnio, startMes, anioEnd, mesEnd);

      for (const p of periodos) {
        // occurrencesForRule ya filtra por rango (mes y, en diaria/semanal,
        // dia) segun la frecuencia de la regla.
        for (const fecha of occurrencesForRule(rule, p.anio, p.mes)) {
          toInsertCandidates.push({ rule, fecha, anio: p.anio, mes: p.mes });
        }
      }
    }

    if (toInsertCandidates.length === 0) return result;

    // Una sola query para descubrir todos los movements YA generados por
    // estas reglas (origenAutomaticoId IN (...)). Filtramos despues por
    // mes/anio en memoria.
    const ruleIds = Array.from(new Set(toInsertCandidates.map((c) => c.rule.id)));
    const existing = await this.db
      .select({
        id: movements.id,
        origenAutomaticoId: movements.origenAutomaticoId,
        fecha: movements.fecha,
      })
      .from(movements)
      .where(
        and(
          inArray(movements.origenAutomaticoId, ruleIds),
          isNull(movements.deletedAt),
        ),
      );

    // Indice rapido "regla+fecha -> existe?" (por dia, no por mes: soporta
    // varias ocurrencias en el mismo mes).
    const existingKey = new Set<string>();
    for (const e of existing) {
      if (e.origenAutomaticoId) {
        const ef = e.fecha instanceof Date ? e.fecha : new Date(e.fecha);
        existingKey.add(`${e.origenAutomaticoId}:${dateKey(ef)}`);
      }
    }

    // Lo que toca insertar (no duplicado).
    const newMovements: NewMovement[] = [];
    const nowMs = now.getTime();

    for (const c of toInsertCandidates) {
      const key = `${c.rule.id}:${dateKey(c.fecha)}`;
      if (existingKey.has(key)) {
        result.skippedExisting++;
        continue;
      }

      const fecha = c.fecha;
      // No materializamos las ocurrencias cuya fecha aun no ha llegado:
      // se exponen como "previstos" en la UI hasta que toque.
      if (fecha.getTime() > nowMs) continue;
      const concepto = c.rule.nombre;

      // Sufijo del ID: con dia solo en frecuencias multi-ocurrencia; los
      // mensuales/anuales conservan `anio-mes` (PK historico -> sin duplicados
      // por sync al actualizar).
      const idSuffix = needsDayInId(c.rule.frecuencia)
        ? `${c.anio}-${c.mes}-${fecha.getUTCDate()}`
        : `${c.anio}-${c.mes}`;

      const newMov: NewMovement = {
        // ID DETERMINISTA: la misma ocurrencia tiene el mismo PK en todos los
        // dispositivos y el sync no la duplica.
        id: autoGenId("rmov", c.rule.id, idSuffix),
        tipo: c.rule.tipoMovimiento,
        fecha,
        concepto,
        importe: c.rule.importe,
        moneda: c.rule.moneda,
        cuentaOrigenId: c.rule.cuentaOrigenId,
        cuentaDestinoId: c.rule.cuentaDestinoId,
        categoriaId: c.rule.categoriaId,
        categoriaTexto: c.rule.categoriaTexto,
        mes: c.mes,
        anio: c.anio,
        notas: c.rule.notas,
        esAutomatico: true,
        // origenAutomatico solo se rellena para reglas vinculadas (11c).
        // Para reglas manuales queda NULL pero origenAutomaticoId si lleva
        // el id de la regla. ('investment' nunca llega aqui: se filtra arriba,
        // y ademas el enum de movements no lo contempla.)
        origenAutomatico:
          c.rule.origenAutomatico === "investment"
            ? null
            : c.rule.origenAutomatico,
        origenAutomaticoId: c.rule.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      newMovements.push(newMov);
    }

    if (newMovements.length > 0) {
      // Insertamos en lotes pequeños. Drizzle sqlite-proxy a veces tiene
      // problemas con batch grande, asi que vamos uno a uno por seguridad.
      for (const m of newMovements) {
        await this.db.insert(movements).values(m);
      }

      // Recuperamos las filas insertadas para devolverlas al caller con
      // sus valores definitivos.
      const insertedIds = newMovements.map((m) => m.id as string);
      const inserted = await this.db
        .select()
        .from(movements)
        .where(inArray(movements.id, insertedIds));
      result.generated = inserted;
    }

    return result;
  }

  /**
   * Borra TODOS los movements generados por una regla concreta (soft delete).
   * Util en Lote 11c cuando se elimina una hipoteca/deuda y hay que
   * limpiar sus movements asociados, o si el usuario quiere "regenerar"
   * tras editar una regla.
   *
   * No toca los movements creados manualmente por el usuario.
   */
  async softDeleteMovementsForRule(ruleId: string): Promise<number> {
    const existing = await this.db
      .select({ id: movements.id })
      .from(movements)
      .where(
        and(
          eq(movements.origenAutomaticoId, ruleId),
          isNull(movements.deletedAt),
        ),
      );

    if (existing.length === 0) return 0;

    const now = new Date();
    await this.db
      .update(movements)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(movements.origenAutomaticoId, ruleId));

    return existing.length;
  }

  /**
   * Soft-delete de los movements generados por una regla cuyo periodo
   * (mes/anio) quede FUERA del rango vigente [fechaInicio, fechaFin].
   *
   * Util al editar una regla: si se mueve fechaInicio hacia adelante
   * (p.ej. abril -> junio) o se acorta fechaFin, los movements ya
   * generados que caigan fuera del nuevo rango quedarian huerfanos.
   * Esto los limpia, conservando los que siguen dentro del rango
   * (historico real). No toca movements manuales (no llevan
   * origenAutomaticoId).
   */
  async softDeleteMovementsOutsideRange(rule: RecurringRule): Promise<number> {
    const startDate =
      rule.fechaInicio instanceof Date
        ? rule.fechaInicio
        : new Date(rule.fechaInicio);
    const endDate = rule.fechaFin
      ? rule.fechaFin instanceof Date
        ? rule.fechaFin
        : new Date(rule.fechaFin)
      : null;

    const existing = await this.db
      .select({
        id: movements.id,
        mes: movements.mes,
        anio: movements.anio,
      })
      .from(movements)
      .where(
        and(
          eq(movements.origenAutomaticoId, rule.id),
          isNull(movements.deletedAt),
        ),
      );

    const outOfRangeIds = existing
      .filter((m) => !isPeriodInRange(m.anio, m.mes, startDate, endDate))
      .map((m) => m.id);

    if (outOfRangeIds.length === 0) return 0;

    const now = new Date();
    await this.db
      .update(movements)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(movements.id, outOfRangeIds));

    return outOfRangeIds.length;
  }
}
