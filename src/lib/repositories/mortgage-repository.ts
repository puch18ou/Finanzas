/**
 * ============================================================================
 *  src/lib/repositories/mortgage-repository.ts
 * ============================================================================
 *
 *  Hipoteca singleton: como mucho una hipoteca activa.
 *
 *  Operaciones:
 *    - get()      → la hipoteca actual (o null si no hay)
 *    - upsert(d)  → crea si no existe, actualiza si existe
 *    - clear()    → soft-delete
 *
 *  IMPORTANTE: el schema define los campos:
 *    precioVivienda, entrada, gastosAsociados, plazoAnios, tin, tipo,
 *    diferencial, tipoReferencia, aniosTipoFijo, moneda, fechaInicio (NOT NULL),
 *    notas, activa.
 *
 *  NO hay `importeHipoteca`: el capital prestado se calcula como
 *  `precioVivienda - entrada + gastosAsociados` en la capa de dominio.
 * ============================================================================
 */

import { eq, isNull } from "drizzle-orm";
import { mortgage, type Mortgage, type NewMortgage } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type MortgageData = Omit<
  NewMortgage,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class MortgageRepository extends BaseRepository {
  async get(): Promise<Mortgage | null> {
    const rows = await this.db
      .select()
      .from(mortgage)
      .where(isNull(mortgage.deletedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Crea o actualiza la hipoteca singleton. Si existe una fila (incluso
   * soft-deleted), la reusa.
   */
  async upsert(data: MortgageData): Promise<Mortgage> {
    const allRows = await this.db.select().from(mortgage).limit(1);
    const existing = allRows[0];

    const ts = now();

    if (existing) {
      await this.db
        .update(mortgage)
        .set({
          ...data,
          updatedAt: ts,
          deletedAt: null,
        })
        .where(eq(mortgage.id, existing.id));
      const updated = await this.get();
      if (!updated) throw new Error("MortgageRepository.upsert: post-update read failed");
      return updated;
    }

    const id = newId();
    await this.db.insert(mortgage).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });
    const created = await this.get();
    if (!created) throw new Error("MortgageRepository.upsert: post-insert read failed");
    return created;
  }

  /**
   * Soft-delete. Conserva la fila por si se quiere recuperar.
   */
  async clear(): Promise<void> {
    const existing = await this.get();
    if (!existing) return;
    const ts = now();
    await this.db
      .update(mortgage)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(mortgage.id, existing.id));
  }
}
