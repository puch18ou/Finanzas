/**
 * ============================================================================
 *  src/lib/repositories/expense-repository.ts
 * ============================================================================
 *
 *  CRUD de gastos. Mas potente que los otros repos porque:
 *
 *    - list(filter) acepta multiples filtros combinables (mes, anio,
 *      categoria, cuenta, texto)
 *    - create() y update() denormalizan automaticamente mes/anio a partir
 *      de la fecha (ver schema.ts seccion EXPENSES)
 *    - listForDashboard() devuelve el set completo del periodo activo
 *      junto con totales precomputados
 *
 *  PATRON DE FILTRO
 *  ----------------
 *  El filtro es un objeto opcional. Cada campo es opcional; si no se
 *  pasa, no se aplica esa restriccion:
 *
 *    list()                                  → todos
 *    list({ anio: 2026 })                    → todos los del 2026
 *    list({ anio: 2026, mes: 1 })            → enero 2026
 *    list({ categoriaId: 'abc' })            → cualquier mes/anio, una categoria
 *    list({ search: 'alquiler' })            → busqueda en concepto
 *
 *  TanStack Query usara el filtro completo como queryKey, de modo que
 *  cambiar filtros invalida la cache de forma natural.
 * ============================================================================
 */

import {
  eq,
  and,
  asc,
  desc,
  isNull,
  isNotNull,
  inArray,
  like,
  type SQL,
} from "drizzle-orm";
import { expenses, type Expense, type NewExpense } from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";
import { extractPeriod, toDateOnly } from "@/lib/utils/dates";

/**
 * Filtros para list(). Todos opcionales.
 */
export type ExpenseFilter = {
  anio?: number;
  mes?: number;
  categoriaId?: string;
  cuentaId?: string;
  /** busqueda case-insensitive en `concepto` */
  search?: string;
  /** ordenacion: por defecto fecha desc */
  sort?: "fecha-desc" | "fecha-asc" | "importe-desc" | "importe-asc";
  /** limit opcional para paginacion */
  limit?: number;
  offset?: number;
};

/**
 * Datos para crear un gasto. Sin `id`, `mes`, `anio`, ni timestamps.
 * El repo se encarga de denormalizar la fecha en mes/anio.
 */
export type CreateExpenseData = Omit<
  NewExpense,
  | "id"
  | "mes"
  | "anio"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

export type UpdateExpenseData = Partial<CreateExpenseData>;

export class ExpenseRepository extends BaseRepository {
  async list(filter: ExpenseFilter = {}): Promise<Expense[]> {
    // Construimos un array de condiciones AND. Drizzle compone el WHERE.
    const conditions: SQL[] = [isNull(expenses.deletedAt)];

    if (filter.anio !== undefined) {
      conditions.push(eq(expenses.anio, filter.anio));
    }
    if (filter.mes !== undefined) {
      conditions.push(eq(expenses.mes, filter.mes));
    }
    if (filter.categoriaId !== undefined) {
      conditions.push(eq(expenses.categoriaId, filter.categoriaId));
    }
    if (filter.cuentaId !== undefined) {
      conditions.push(eq(expenses.cuentaId, filter.cuentaId));
    }
    if (filter.search !== undefined && filter.search.trim() !== "") {
      // LIKE con wildcards. SQLite es case-insensitive en LIKE solo con
      // strings ASCII; para internacional usariamos LOWER() pero rompemos
      // indices. Aceptable para el tamaño de datos personales.
      conditions.push(like(expenses.concepto, `%${filter.search}%`));
    }

    const whereClause = conditions.length === 1
      ? conditions[0]!
      : and(...conditions)!;

    // Orden
    let orderClause;
    switch (filter.sort) {
      case "fecha-asc":
        orderClause = [asc(expenses.fecha), asc(expenses.createdAt)];
        break;
      case "importe-desc":
        orderClause = [desc(expenses.importe), desc(expenses.fecha)];
        break;
      case "importe-asc":
        orderClause = [asc(expenses.importe), desc(expenses.fecha)];
        break;
      case "fecha-desc":
      default:
        orderClause = [desc(expenses.fecha), desc(expenses.createdAt)];
        break;
    }

    let query = this.db
      .select()
      .from(expenses)
      .where(whereClause)
      .orderBy(...orderClause)
      .$dynamic();

    if (filter.limit !== undefined) {
      query = query.limit(filter.limit);
    }
    if (filter.offset !== undefined) {
      query = query.offset(filter.offset);
    }

    return query;
  }

  /**
   * Cuenta cuantos gastos cumplen un filtro. Util para paginacion futura.
   */
  async count(filter: ExpenseFilter = {}): Promise<number> {
    // Reusamos list() y contamos en memoria. Es suficiente para volumenes
    // personales (miles, no millones).
    const rows = await this.list({ ...filter, limit: undefined, offset: undefined });
    return rows.length;
  }

  async listDeleted(): Promise<Expense[]> {
    return this.db
      .select()
      .from(expenses)
      .where(isNotNull(expenses.deletedAt))
      .orderBy(desc(expenses.deletedAt));
  }

  async getById(id: string): Promise<Expense | null> {
    const rows = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Crea un gasto. Denormaliza fecha→(mes,anio) automaticamente para que
   * el caller no tenga que pensarlo.
   */
  async create(data: CreateExpenseData): Promise<Expense> {
    const ts = now();
    const id = newId();

    // Forzamos fecha-only y extraemos periodo
    const fechaPura = toDateOnly(data.fecha);
    const { mes, anio } = extractPeriod(fechaPura);

    await this.db.insert(expenses).values({
      ...data,
      fecha: fechaPura,
      mes,
      anio,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("ExpenseRepository.create: post-insert read failed");
    return created;
  }

  /**
   * Actualiza un gasto. Si la fecha cambia, recalcula mes/anio.
   */
  async update(id: string, patch: UpdateExpenseData): Promise<Expense> {
    // Si el patch incluye `fecha`, denormalizamos.
    const enrichedPatch: Partial<NewExpense> = { ...patch };
    if (patch.fecha !== undefined) {
      const fechaPura = toDateOnly(patch.fecha);
      enrichedPatch.fecha = fechaPura;
      const { mes, anio } = extractPeriod(fechaPura);
      enrichedPatch.mes = mes;
      enrichedPatch.anio = anio;
    }

    await this.db
      .update(expenses)
      .set({ ...enrichedPatch, updatedAt: now() })
      .where(eq(expenses.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`ExpenseRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(expenses)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(expenses.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(expenses)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(expenses.id, id));
  }

  /**
   * Conveniencia: borra varias filas de una vez.
   */
  async softDeleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const ts = now();
    await this.db
      .update(expenses)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(inArray(expenses.id, ids));
  }
}
