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
import { nanoid } from "nanoid";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { movements, recurringRules } from "@/lib/db/schema";
import type {
  Movement,
  NewMovement,
  RecurringRule,
} from "@/lib/db/schema";
import {
  anioMesToComparableNumber,
  buildPeriodDate,
  currentPeriod,
  isPeriodInRange,
  periodsBetween,
} from "@/lib/domain/recurring";

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
    return this.generateUpTo(anio, mes);
  }

  /**
   * Como generatePendingUpToCurrentMonth pero permitiendo especificar
   * el periodo final (util para tests).
   */
  async generateUpTo(
    anioEnd: number,
    mesEnd: number,
  ): Promise<RecurringGenerationResult> {
    const allRules = await this.db.select().from(recurringRules).where(
      isNull(recurringRules.deletedAt),
    );

    const activeRules = allRules.filter((r) => r.activa);
    const inactiveRulesSkipped = allRules.length - activeRules.length;

    const result: RecurringGenerationResult = {
      generated: [],
      skippedExisting: 0,
      inactiveRulesSkipped,
    };

    if (activeRules.length === 0) return result;

    // Para cada regla calculamos los movements que TOCARIA crear.
    const toInsertCandidates: Array<{
      rule: RecurringRule;
      anio: number;
      mes: number;
    }> = [];

    for (const rule of activeRules) {
      const startDate =
        rule.fechaInicio instanceof Date
          ? rule.fechaInicio
          : new Date(rule.fechaInicio);
      const endDate = rule.fechaFin
        ? rule.fechaFin instanceof Date
          ? rule.fechaFin
          : new Date(rule.fechaFin)
        : null;

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
        if (isPeriodInRange(p.anio, p.mes, startDate, endDate)) {
          toInsertCandidates.push({ rule, anio: p.anio, mes: p.mes });
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
        mes: movements.mes,
        anio: movements.anio,
      })
      .from(movements)
      .where(
        and(
          inArray(movements.origenAutomaticoId, ruleIds),
          isNull(movements.deletedAt),
        ),
      );

    // Indice rapido "regla+mes+anio -> existe?"
    const existingKey = new Set<string>();
    for (const e of existing) {
      if (e.origenAutomaticoId) {
        existingKey.add(`${e.origenAutomaticoId}:${e.anio}:${e.mes}`);
      }
    }

    // Lo que toca insertar (no duplicado).
    const newMovements: NewMovement[] = [];

    for (const c of toInsertCandidates) {
      const key = `${c.rule.id}:${c.anio}:${c.mes}`;
      if (existingKey.has(key)) {
        result.skippedExisting++;
        continue;
      }

      const fecha = buildPeriodDate(c.rule.diaDelMes, c.anio, c.mes);
      const concepto = c.rule.nombre;

      const newMov: NewMovement = {
        id: nanoid(),
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
        // el id de la regla.
        origenAutomatico: c.rule.origenAutomatico,
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
