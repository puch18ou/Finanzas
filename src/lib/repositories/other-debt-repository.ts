/**
 * ============================================================================
 *  src/lib/repositories/other-debt-repository.ts
 * ============================================================================
 *
 *  CRUD para "Otras deudas" (prestamos personales, coche, tarjetas con cuota).
 *  Schema real:
 *    otherDebts: { id, concepto, tipo, importeInicial, capitalPendiente, tin,
 *                  plazoRestanteMeses, moneda, fechaInicio?, notas? }
 * ============================================================================
 */

import { eq, asc, isNull, isNotNull } from "drizzle-orm";
import { otherDebts, type OtherDebt, type NewOtherDebt } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateOtherDebtData = Omit<
  NewOtherDebt,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdateOtherDebtData = Partial<CreateOtherDebtData>;

export class OtherDebtRepository extends BaseRepository {
  async list(): Promise<OtherDebt[]> {
    return this.db
      .select()
      .from(otherDebts)
      .where(isNull(otherDebts.deletedAt))
      .orderBy(asc(otherDebts.concepto));
  }

  async listDeleted(): Promise<OtherDebt[]> {
    return this.db
      .select()
      .from(otherDebts)
      .where(isNotNull(otherDebts.deletedAt))
      .orderBy(asc(otherDebts.concepto));
  }

  async getById(id: string): Promise<OtherDebt | null> {
    const rows = await this.db
      .select()
      .from(otherDebts)
      .where(eq(otherDebts.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateOtherDebtData): Promise<OtherDebt> {
    const ts = now();
    const id = newId();
    await this.db.insert(otherDebts).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });
    const created = await this.getById(id);
    if (!created) throw new Error("OtherDebtRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateOtherDebtData): Promise<OtherDebt> {
    await this.db
      .update(otherDebts)
      .set({ ...patch, updatedAt: now() })
      .where(eq(otherDebts.id, id));
    const updated = await this.getById(id);
    if (!updated) throw new Error(`OtherDebtRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(otherDebts)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(otherDebts.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(otherDebts)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(otherDebts.id, id));
  }
}
