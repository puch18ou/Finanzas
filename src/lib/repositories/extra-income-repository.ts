/**
 * ============================================================================
 *  src/lib/repositories/extra-income-repository.ts
 * ============================================================================
 *
 *  CRUD de ingresos puntuales (premios, bonus, regalos, reembolsos). Mismo
 *  patron que ExpenseRepository: denormaliza fecha → (mes, anio) y permite
 *  filtros combinados.
 *
 *  La estructura de la tabla es muy similar a expenses; en lugar de
 *  categoriaId con FK, usa un campo `categoria` libre (string).
 * ============================================================================
 */

import {
  eq,
  and,
  asc,
  desc,
  isNull,
  isNotNull,
  like,
  type SQL,
} from "drizzle-orm";
import {
  extraIncomes,
  type ExtraIncome,
  type NewExtraIncome,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";
import { extractPeriod, toDateOnly } from "@/lib/utils/dates";

export type ExtraIncomeFilter = {
  anio?: number;
  mes?: number;
  categoria?: string;
  search?: string;
  sort?: "fecha-desc" | "fecha-asc";
};

export type CreateExtraIncomeData = Omit<
  NewExtraIncome,
  "id" | "mes" | "anio" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdateExtraIncomeData = Partial<CreateExtraIncomeData>;

export class ExtraIncomeRepository extends BaseRepository {
  async list(filter: ExtraIncomeFilter = {}): Promise<ExtraIncome[]> {
    const conditions: SQL[] = [isNull(extraIncomes.deletedAt)];

    if (filter.anio !== undefined) {
      conditions.push(eq(extraIncomes.anio, filter.anio));
    }
    if (filter.mes !== undefined) {
      conditions.push(eq(extraIncomes.mes, filter.mes));
    }
    if (filter.categoria !== undefined) {
      conditions.push(eq(extraIncomes.categoria, filter.categoria));
    }
    if (filter.search !== undefined && filter.search.trim() !== "") {
      conditions.push(like(extraIncomes.concepto, `%${filter.search}%`));
    }

    const whereClause = conditions.length === 1
      ? conditions[0]!
      : and(...conditions)!;

    const orderClause =
      filter.sort === "fecha-asc"
        ? [asc(extraIncomes.fecha), asc(extraIncomes.createdAt)]
        : [desc(extraIncomes.fecha), desc(extraIncomes.createdAt)];

    return this.db
      .select()
      .from(extraIncomes)
      .where(whereClause)
      .orderBy(...orderClause);
  }

  async listDeleted(): Promise<ExtraIncome[]> {
    return this.db
      .select()
      .from(extraIncomes)
      .where(isNotNull(extraIncomes.deletedAt))
      .orderBy(desc(extraIncomes.deletedAt));
  }

  async getById(id: string): Promise<ExtraIncome | null> {
    const rows = await this.db
      .select()
      .from(extraIncomes)
      .where(eq(extraIncomes.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateExtraIncomeData): Promise<ExtraIncome> {
    const ts = now();
    const id = newId();

    const fechaPura = toDateOnly(data.fecha);
    const { mes, anio } = extractPeriod(fechaPura);

    await this.db.insert(extraIncomes).values({
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
    if (!created) throw new Error("ExtraIncomeRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateExtraIncomeData): Promise<ExtraIncome> {
    const enrichedPatch: Partial<NewExtraIncome> = { ...patch };
    if (patch.fecha !== undefined) {
      const fechaPura = toDateOnly(patch.fecha);
      enrichedPatch.fecha = fechaPura;
      const { mes, anio } = extractPeriod(fechaPura);
      enrichedPatch.mes = mes;
      enrichedPatch.anio = anio;
    }

    await this.db
      .update(extraIncomes)
      .set({ ...enrichedPatch, updatedAt: now() })
      .where(eq(extraIncomes.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`ExtraIncomeRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(extraIncomes)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(extraIncomes.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(extraIncomes)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(extraIncomes.id, id));
  }
}
