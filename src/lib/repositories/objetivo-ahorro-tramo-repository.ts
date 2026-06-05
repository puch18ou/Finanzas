/**
 * ============================================================================
 *  src/lib/repositories/objetivo-ahorro-tramo-repository.ts
 * ============================================================================
 *
 *  CRUD de los tramos del objetivo de ahorro (valor con vigencia). Cada fila
 *  es un cambio "a partir de este mes el objetivo pasa a ser X". El tramo base
 *  (desdeAnio/desdeMes = null) aplica "desde siempre".
 *
 *  La resolucion del objetivo vigente para un mes concreto vive en el dominio
 *  (src/lib/domain/tramos.ts), no aqui: el repo solo persiste.
 * ============================================================================
 */

import { eq, asc, isNull } from "drizzle-orm";
import {
  objetivoAhorroTramos,
  type ObjetivoAhorroTramo,
  type NewObjetivoAhorroTramo,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateObjetivoAhorroTramoData = Omit<
  NewObjetivoAhorroTramo,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdateObjetivoAhorroTramoData =
  Partial<CreateObjetivoAhorroTramoData>;

export class ObjetivoAhorroTramoRepository extends BaseRepository {
  /** Tramos activos, base ("desde siempre") primero y luego por fecha asc. */
  async list(): Promise<ObjetivoAhorroTramo[]> {
    return this.db
      .select()
      .from(objetivoAhorroTramos)
      .where(isNull(objetivoAhorroTramos.deletedAt))
      .orderBy(
        asc(objetivoAhorroTramos.desdeAnio),
        asc(objetivoAhorroTramos.desdeMes),
      );
  }

  async getById(id: string): Promise<ObjetivoAhorroTramo | null> {
    const rows = await this.db
      .select()
      .from(objetivoAhorroTramos)
      .where(eq(objetivoAhorroTramos.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(
    data: CreateObjetivoAhorroTramoData,
  ): Promise<ObjetivoAhorroTramo> {
    const ts = now();
    const id = newId();

    await this.db.insert(objetivoAhorroTramos).values({
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
    patch: UpdateObjetivoAhorroTramoData,
  ): Promise<ObjetivoAhorroTramo> {
    await this.db
      .update(objetivoAhorroTramos)
      .set({ ...patch, updatedAt: now() })
      .where(eq(objetivoAhorroTramos.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error("id no existe");
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(objetivoAhorroTramos)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(objetivoAhorroTramos.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(objetivoAhorroTramos)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(objetivoAhorroTramos.id, id));
  }
}
