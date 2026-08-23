/**
 * ============================================================================
 *  src/lib/repositories/account-repository.ts
 * ============================================================================
 *
 *  CRUD de cuentas. Mismo patron que categories: list, getById, create,
 *  update, softDelete, restore, reorder.
 *
 *  Diferencias notables:
 *    - El campo `saldoInicial` puede ser negativo (tarjetas de credito).
 *      El saldo actual NO se guarda: se calcula en domain/accounts.
 *    - El filtro por defecto incluye solo cuentas con activa=true y
 *      deletedAt=null. `listAll()` devuelve todas.
 * ============================================================================
 */

import { eq, asc, isNull, isNotNull, max, and } from "drizzle-orm";
import { accounts, type Account, type NewAccount } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateAccountData = Omit<
  NewAccount,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "orden"
>;

export type UpdateAccountData = Partial<CreateAccountData>;

export class AccountRepository extends BaseRepository {
  /** Cuentas activas y no borradas. */
  async list(): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(and(isNull(accounts.deletedAt), eq(accounts.activa, true)))
      .orderBy(asc(accounts.orden), asc(accounts.alias));
  }

  /** Cuentas no borradas (activas + inactivas). */
  async listAll(): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.orden), asc(accounts.alias));
  }

  /** Cuentas borradas (papelera). */
  async listDeleted(): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(isNotNull(accounts.deletedAt))
      .orderBy(asc(accounts.alias));
  }

  async getById(id: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateAccountData): Promise<Account> {
    const result = await this.db
      .select({ maxOrden: max(accounts.orden) })
      .from(accounts);
    const nextOrden = (result[0]?.maxOrden ?? -1) + 1;

    const ts = now();
    const id = newId();

    await this.db.insert(accounts).values({
      ...data,
      id,
      orden: nextOrden,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("AccountRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateAccountData): Promise<Account> {
    await this.db
      .update(accounts)
      .set({ ...patch, updatedAt: now() })
      .where(eq(accounts.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`AccountRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(accounts)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(accounts.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(accounts.id, id));
  }

  /** Borrado FISICO (no papelera). Usado por la demo para limpiar sus datos. */
  async hardDelete(id: string): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.id, id));
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const ts = now();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!id) continue;
      await this.db
        .update(accounts)
        .set({ orden: i, updatedAt: ts })
        .where(eq(accounts.id, id));
    }
  }
}
