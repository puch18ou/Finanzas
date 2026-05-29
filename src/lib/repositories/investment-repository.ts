/**
 * ============================================================================
 *  src/lib/repositories/investment-repository.ts
 * ============================================================================
 *
 *  CRUD de inversiones. Mismo patron que categories/accounts pero SIN
 *  campo `orden` (la tabla investments no lo tiene en el schema).
 *
 *  Operaciones especificas:
 *    - updatePrice(id, nuevoPrecio): atajo para actualizar solo el precio
 *      actual. Pensado para edicion inline desde la tabla y para una
 *      futura integracion con API de cotizaciones.
 *
 *  Ordenacion en list(): por nombre alfabetico, ya que no hay un campo
 *  explicito de orden.
 * ============================================================================
 */

import { and, eq, asc, isNull, isNotNull } from "drizzle-orm";
import {
  investments,
  type Investment,
  type NewInvestment,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateInvestmentData = Omit<
  NewInvestment,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "archivada"
>;

export type UpdateInvestmentData = Partial<CreateInvestmentData>;

export class InvestmentRepository extends BaseRepository {
  /** Inversiones activas: no borradas y NO archivadas. */
  async list(): Promise<Investment[]> {
    return this.db
      .select()
      .from(investments)
      .where(and(isNull(investments.deletedAt), eq(investments.archivada, false)))
      .orderBy(asc(investments.nombre));
  }

  /** Inversiones archivadas (no borradas). */
  async listArchived(): Promise<Investment[]> {
    return this.db
      .select()
      .from(investments)
      .where(and(isNull(investments.deletedAt), eq(investments.archivada, true)))
      .orderBy(asc(investments.nombre));
  }

  async listDeleted(): Promise<Investment[]> {
    return this.db
      .select()
      .from(investments)
      .where(isNotNull(investments.deletedAt))
      .orderBy(asc(investments.nombre));
  }

  async getById(id: string): Promise<Investment | null> {
    const rows = await this.db
      .select()
      .from(investments)
      .where(eq(investments.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateInvestmentData): Promise<Investment> {
    const ts = now();
    const id = newId();

    await this.db.insert(investments).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("InvestmentRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateInvestmentData): Promise<Investment> {
    await this.db
      .update(investments)
      .set({ ...patch, updatedAt: now() })
      .where(eq(investments.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`InvestmentRepository.update: id ${id} no existe`);
    return updated;
  }

  /**
   * Atajo: solo actualiza el precio actual. Pensado para edicion inline
   * y para una futura integracion con API de cotizaciones.
   */
  async updatePrice(id: string, nuevoPrecio: number): Promise<Investment> {
    return this.update(id, { precioActual: nuevoPrecio });
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(investments)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(investments.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(investments)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(investments.id, id));
  }

  async archive(id: string): Promise<void> {
    await this.db
      .update(investments)
      .set({ archivada: true, updatedAt: now() })
      .where(eq(investments.id, id));
  }

  async unarchive(id: string): Promise<void> {
    await this.db
      .update(investments)
      .set({ archivada: false, updatedAt: now() })
      .where(eq(investments.id, id));
  }

  /** Borrado fisico (papelera). Las aportaciones hijas se borran aparte. */
  async hardDelete(id: string): Promise<void> {
    await this.db.delete(investments).where(eq(investments.id, id));
  }
}
