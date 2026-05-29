/**
 * ============================================================================
 *  src/lib/repositories/recurring-rule-repository.ts
 * ============================================================================
 *
 *  CRUD de reglas recurrentes. Soft delete (deletedAt).
 *
 *  Las queries de lectura mas usadas:
 *    - listActive(): reglas activas, no borradas. Para el servicio que
 *                    genera movements al arrancar.
 *    - listByOrigen(): reglas vinculadas a una entidad concreta (e.g.
 *                       reglas de una hipoteca). Para 11c.
 *
 *  El metodo `existsForOrigen` se usa en 11c para evitar crear reglas
 *  duplicadas al editar entidades padre.
 * ============================================================================
 */

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { recurringRules } from "@/lib/db/schema";
import type {
  RecurringRule,
  NewRecurringRule,
} from "@/lib/db/schema";

export type RecurringRuleType =
  | "gasto"
  | "ingreso"
  | "transferencia"
  | "cuota"
  | "intereses";

export type RecurringRuleOrigen =
  | "mortgage"
  | "debt"
  | "interest"
  | "investment";

export type RecurringFrecuencia = "diaria" | "semanal" | "mensual";

export type CreateRecurringRuleData = {
  nombre: string;
  tipoMovimiento: RecurringRuleType;
  importe: number;
  moneda: string;
  cuentaOrigenId?: string | null;
  cuentaDestinoId?: string | null;
  categoriaId?: string | null;
  categoriaTexto?: string | null;
  diaDelMes: number;
  fechaInicio: Date;
  fechaFin?: Date | null;
  /** 'mensual' por defecto. 'semanal' usa diaSemana; 'diaria' ninguno. */
  frecuencia?: RecurringFrecuencia;
  /** 0=domingo..6=sabado. Solo para frecuencia 'semanal'. */
  diaSemana?: number | null;
  activa?: boolean;
  origenAutomatico?: RecurringRuleOrigen | null;
  origenAutomaticoId?: string | null;
  notas?: string | null;
};

export type UpdateRecurringRuleData = Partial<
  Omit<CreateRecurringRuleData, "origenAutomatico" | "origenAutomaticoId">
>;

export class RecurringRuleRepository {
  constructor(private db: DrizzleDb) {}

  /**
   * Todas las reglas no borradas (activas + inactivas).
   * Ordenadas: las activas primero, luego por nombre.
   */
  async list(): Promise<RecurringRule[]> {
    const rows = await this.db
      .select()
      .from(recurringRules)
      .where(isNull(recurringRules.deletedAt));
    return rows.sort((a, b) => {
      if (a.activa !== b.activa) return a.activa ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  /**
   * Solo reglas activas, no borradas. Usado por RecurringService.
   */
  async listActive(): Promise<RecurringRule[]> {
    return this.db
      .select()
      .from(recurringRules)
      .where(
        and(eq(recurringRules.activa, true), isNull(recurringRules.deletedAt)),
      );
  }

  /**
   * Reglas vinculadas a un origen concreto (e.g. todas las reglas de la
   * hipoteca X). Util en Lote 11c.
   */
  async listByOrigen(
    origen: RecurringRuleOrigen,
    origenId: string,
  ): Promise<RecurringRule[]> {
    return this.db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.origenAutomatico, origen),
          eq(recurringRules.origenAutomaticoId, origenId),
          isNull(recurringRules.deletedAt),
        ),
      );
  }

  /**
   * Indica si ya existe alguna regla viva para ese origen. Util para no
   * duplicar al editar una hipoteca/deuda.
   */
  async existsForOrigen(
    origen: RecurringRuleOrigen,
    origenId: string,
  ): Promise<boolean> {
    const rows = await this.listByOrigen(origen, origenId);
    return rows.length > 0;
  }

  async getById(id: string): Promise<RecurringRule | null> {
    const rows = await this.db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.id, id));
    return rows[0] ?? null;
  }

  async create(data: CreateRecurringRuleData): Promise<RecurringRule> {
    const now = new Date();
    const id = nanoid();

    const row: NewRecurringRule = {
      id,
      nombre: data.nombre,
      tipoMovimiento: data.tipoMovimiento,
      importe: data.importe,
      moneda: data.moneda,
      cuentaOrigenId: data.cuentaOrigenId ?? null,
      cuentaDestinoId: data.cuentaDestinoId ?? null,
      categoriaId: data.categoriaId ?? null,
      categoriaTexto: data.categoriaTexto ?? null,
      diaDelMes: data.diaDelMes,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin ?? null,
      frecuencia: data.frecuencia ?? "mensual",
      diaSemana: data.diaSemana ?? null,
      activa: data.activa ?? true,
      origenAutomatico: data.origenAutomatico ?? null,
      origenAutomaticoId: data.origenAutomaticoId ?? null,
      notas: data.notas ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.db.insert(recurringRules).values(row);
    const created = await this.getById(id);
    if (!created) throw new Error("No se pudo crear la regla recurrente");
    return created;
  }

  async update(
    id: string,
    patch: UpdateRecurringRuleData,
  ): Promise<RecurringRule> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Regla ${id} no encontrada`);

    await this.db
      .update(recurringRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recurringRules.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`Regla ${id} no encontrada tras update`);
    return updated;
  }

  /**
   * Soft delete: marca deletedAt. Si el usuario quiere "volver a activarla"
   * puede restaurarla desde la papelera.
   */
  async softDelete(id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(recurringRules)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(recurringRules.id, id));
  }

  /**
   * Restaura una regla soft-deleted.
   */
  async restore(id: string): Promise<void> {
    await this.db
      .update(recurringRules)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(recurringRules.id, id));
  }

  /**
   * Hard delete: solo para vaciar papelera.
   */
  async hardDelete(id: string): Promise<void> {
    await this.db.delete(recurringRules).where(eq(recurringRules.id, id));
  }

  /**
   * Lista soft-deleted (para papelera).
   */
  async listDeleted(): Promise<RecurringRule[]> {
    return this.db
      .select()
      .from(recurringRules)
      .where(isNotNull(recurringRules.deletedAt));
  }
}
