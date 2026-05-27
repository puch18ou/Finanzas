/**
 * ============================================================================
 *  src/lib/repositories/goal-repository.ts
 * ============================================================================
 *
 *  CRUD de metas de ahorro. Igual patron que el resto.
 *
 *  NOTAS DE MODELADO
 *  -----------------
 *  - cuentaVinculadaId es opcional. Si esta presente, en la UI mostraremos
 *    el saldo de esa cuenta como "yaAhorrado" en lugar del campo guardado.
 *  - `completada` se calcula en el dominio (cuando yaAhorrado >= objetivo).
 *    Lo guardamos por si en el futuro queremos historico de "el dia X la
 *    meta paso a completada", pero no es la fuente de verdad: la calcula
 *    el dominio.
 * ============================================================================
 */

import { eq, asc, isNull, isNotNull } from "drizzle-orm";
import { goals, type Goal, type NewGoal } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateGoalData = Omit<
  NewGoal,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdateGoalData = Partial<CreateGoalData>;

export class GoalRepository extends BaseRepository {
  async list(): Promise<Goal[]> {
    return this.db
      .select()
      .from(goals)
      .where(isNull(goals.deletedAt))
      .orderBy(asc(goals.fechaObjetivo), asc(goals.nombre));
  }

  async listDeleted(): Promise<Goal[]> {
    return this.db
      .select()
      .from(goals)
      .where(isNotNull(goals.deletedAt))
      .orderBy(asc(goals.nombre));
  }

  async getById(id: string): Promise<Goal | null> {
    const rows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateGoalData): Promise<Goal> {
    const ts = now();
    const id = newId();

    await this.db.insert(goals).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("GoalRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateGoalData): Promise<Goal> {
    await this.db
      .update(goals)
      .set({ ...patch, updatedAt: now() })
      .where(eq(goals.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`GoalRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(goals)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(goals.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(goals)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(goals.id, id));
  }
}
