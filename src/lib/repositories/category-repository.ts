/**
 * ============================================================================
 *  src/lib/repositories/category-repository.ts
 * ============================================================================
 *
 *  CRUD completo de categorias con soft delete. Operaciones:
 *
 *    list()          - todas las activas, ordenadas por `orden`
 *    listIncludingDeleted() - utilidad para auditoria/recuperacion
 *    getById(id)
 *    create(data)    - asigna UUID, timestamps y orden = max + 1
 *    update(id, patch)
 *    softDelete(id)  - marca deletedAt, no borra fisicamente
 *    restore(id)     - quita deletedAt
 *    reorder(ids)    - reasigna campo `orden` segun el array recibido
 *
 *  Patron que repetiremos en los demas repos CRUD (cuentas, gastos, etc).
 * ============================================================================
 */

import { eq, asc, isNull, isNotNull, max, inArray } from "drizzle-orm";
import { categories, type Category, type NewCategory } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

/**
 * Datos para crear una categoria. Omitimos los campos automaticos:
 * id (UUID), timestamps, deletedAt, y orden (se calcula como max+1).
 */
export type CreateCategoryData = Omit<
  NewCategory,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "orden"
>;

/**
 * Datos para actualizar. Todos los campos son opcionales.
 */
export type UpdateCategoryData = Partial<CreateCategoryData>;

export class CategoryRepository extends BaseRepository {
  /** Lista categorias activas, ordenadas. */
  async list(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.orden), asc(categories.nombre));
  }

  /** Lista TODAS, incluyendo las borradas. */
  async listIncludingDeleted(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .orderBy(asc(categories.orden), asc(categories.nombre));
  }

  /** Lista solo las borradas (para una pantalla de "papelera" futura). */
  async listDeleted(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(isNotNull(categories.deletedAt))
      .orderBy(asc(categories.nombre));
  }

  async getById(id: string): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateCategoryData): Promise<Category> {
    // Asignar siguiente orden disponible.
    const result = await this.db
      .select({ maxOrden: max(categories.orden) })
      .from(categories);
    const nextOrden = (result[0]?.maxOrden ?? -1) + 1;

    const ts = now();
    const id = newId();

    await this.db.insert(categories).values({
      ...data,
      id,
      orden: nextOrden,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("CategoryRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateCategoryData): Promise<Category> {
    await this.db
      .update(categories)
      .set({ ...patch, updatedAt: now() })
      .where(eq(categories.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`CategoryRepository.update: id ${id} no existe`);
    return updated;
  }

  /**
   * Soft delete: marca deletedAt. La categoria desaparece de las listas
   * normales pero los gastos que la referencien siguen siendo validos
   * (la FK no se rompe).
   */
  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(categories)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(categories.id, id));
  }

  /**
   * Restaura una categoria borrada. Util si el usuario se arrepiente.
   */
  async restore(id: string): Promise<void> {
    await this.db
      .update(categories)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(categories.id, id));
  }

  /**
   * Reordena. Asigna `orden = 0, 1, 2, ...` segun el array recibido de IDs.
   * Ids no incluidos en el array conservan su orden actual (raro pero valido).
   *
   * Usaremos esto cuando el usuario arrastre categorias en la UI para
   * reordenarlas.
   */
  async reorder(orderedIds: string[]): Promise<void> {
    const ts = now();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!id) continue;
      await this.db
        .update(categories)
        .set({ orden: i, updatedAt: ts })
        .where(eq(categories.id, id));
    }
  }

  /**
   * Conveniencia: busca varias categorias por sus ids. Util para join
   * en memoria desde la lista de gastos.
   */
  async getByIds(ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(categories)
      .where(inArray(categories.id, ids));
  }
}
