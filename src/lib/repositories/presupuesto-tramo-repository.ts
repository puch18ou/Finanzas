/**
 * ============================================================================
 *  src/lib/repositories/presupuesto-tramo-repository.ts
 * ============================================================================
 *
 *  CRUD de los tramos de presupuesto por categoria (valor con vigencia). Cada
 *  fila es "a partir de este mes, el presupuesto de esta categoria pasa a ser
 *  X". El tramo base (desdeAnio/desdeMes = null) aplica "desde siempre".
 *
 *  La resolucion del presupuesto vigente para un mes vive en el dominio
 *  (src/lib/domain/tramos.ts); el repo solo persiste.
 * ============================================================================
 */

import { eq, asc, isNull } from "drizzle-orm";
import {
  presupuestoTramos,
  type PresupuestoTramo,
  type NewPresupuestoTramo,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreatePresupuestoTramoData = Omit<
  NewPresupuestoTramo,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdatePresupuestoTramoData = Partial<CreatePresupuestoTramoData>;

export class PresupuestoTramoRepository extends BaseRepository {
  /** Todos los tramos activos, por categoria y fecha asc (base primero). */
  async list(): Promise<PresupuestoTramo[]> {
    return this.db
      .select()
      .from(presupuestoTramos)
      .where(isNull(presupuestoTramos.deletedAt))
      .orderBy(
        asc(presupuestoTramos.categoriaId),
        asc(presupuestoTramos.desdeAnio),
        asc(presupuestoTramos.desdeMes),
      );
  }

  async getById(id: string): Promise<PresupuestoTramo | null> {
    const rows = await this.db
      .select()
      .from(presupuestoTramos)
      .where(eq(presupuestoTramos.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreatePresupuestoTramoData): Promise<PresupuestoTramo> {
    const ts = now();
    const id = newId();

    await this.db.insert(presupuestoTramos).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("post-insert read failed");
    return created;
  }

  async update(
    id: string,
    patch: UpdatePresupuestoTramoData,
  ): Promise<PresupuestoTramo> {
    await this.db
      .update(presupuestoTramos)
      .set({ ...patch, updatedAt: now() })
      .where(eq(presupuestoTramos.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error("id no existe");
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(presupuestoTramos)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(presupuestoTramos.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(presupuestoTramos)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(presupuestoTramos.id, id));
  }
}
