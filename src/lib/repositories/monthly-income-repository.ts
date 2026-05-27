/**
 * ============================================================================
 *  src/lib/repositories/monthly-income-repository.ts
 * ============================================================================
 *
 *  Gestion de ingresos mensuales. Esta tabla tiene una restriccion UNIQUE
 *  en (anio, mes), por lo que el patron natural es UPSERT: o existe la
 *  fila para (2026, 1), o la creamos al editar.
 *
 *  La UI tipica es: una tabla con 12 filas (los 12 meses del año activo).
 *  El usuario edita una celda inline → llamamos a upsertByPeriod() que
 *  decide si crear o actualizar.
 *
 *  ensureYearExists() garantiza que existen las 12 filas del año pedido
 *  (con valores a 0). Lo llamamos al cargar la pagina de Ingresos.
 * ============================================================================
 */

import { eq, and, asc, isNull } from "drizzle-orm";
import {
  monthlyIncomes,
  type MonthlyIncome,
  type NewMonthlyIncome,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

/**
 * Datos que se pueden cambiar en una fila mensual.
 * (anio, mes, moneda) son la "clave" y normalmente no cambian.
 */
export type MonthlyIncomeFields = {
  salario?: number;
  bonus?: number;
  otros?: number;
  moneda?: string;
  notas?: string | null;
};

export class MonthlyIncomeRepository extends BaseRepository {
  /**
   * Lista los ingresos de un año concreto, ordenados por mes ascendente.
   * No incluye soft-deleted.
   */
  async listByYear(anio: number): Promise<MonthlyIncome[]> {
    return this.db
      .select()
      .from(monthlyIncomes)
      .where(
        and(
          isNull(monthlyIncomes.deletedAt),
          eq(monthlyIncomes.anio, anio),
        )!,
      )
      .orderBy(asc(monthlyIncomes.mes));
  }

  async getByPeriod(anio: number, mes: number): Promise<MonthlyIncome | null> {
    const rows = await this.db
      .select()
      .from(monthlyIncomes)
      .where(
        and(
          isNull(monthlyIncomes.deletedAt),
          eq(monthlyIncomes.anio, anio),
          eq(monthlyIncomes.mes, mes),
        )!,
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Crea o actualiza la fila de (anio, mes). Si no existe, la crea con
   * todos los campos no especificados a 0.
   *
   * Si se pasa `moneda`, se respeta; si no y se esta creando, hay que
   * dar una moneda por defecto (lo controla el caller).
   */
  async upsertByPeriod(
    anio: number,
    mes: number,
    fields: MonthlyIncomeFields & { moneda: string },
  ): Promise<MonthlyIncome> {
    const existing = await this.getByPeriod(anio, mes);
    const ts = now();

    if (existing) {
      // UPDATE
      const patch: Partial<NewMonthlyIncome> = {};
      if (fields.salario !== undefined) patch.salario = fields.salario;
      if (fields.bonus !== undefined) patch.bonus = fields.bonus;
      if (fields.otros !== undefined) patch.otros = fields.otros;
      if (fields.moneda !== undefined) patch.moneda = fields.moneda;
      if (fields.notas !== undefined) patch.notas = fields.notas;
      patch.updatedAt = ts;

      await this.db
        .update(monthlyIncomes)
        .set(patch)
        .where(eq(monthlyIncomes.id, existing.id));

      const refreshed = await this.getByPeriod(anio, mes);
      if (!refreshed) throw new Error("upsertByPeriod: post-update read failed");
      return refreshed;
    }

    // INSERT
    const id = newId();
    await this.db.insert(monthlyIncomes).values({
      id,
      anio,
      mes,
      salario: fields.salario ?? 0,
      bonus: fields.bonus ?? 0,
      otros: fields.otros ?? 0,
      moneda: fields.moneda,
      notas: fields.notas ?? null,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getByPeriod(anio, mes);
    if (!created) throw new Error("upsertByPeriod: post-insert read failed");
    return created;
  }

  /**
   * Garantiza que existen las 12 filas del año (creando las que falten
   * con valores a 0 y la moneda dada). Idempotente: si ya existen, no toca.
   *
   * Devuelve la lista completa de las 12 filas, ordenadas por mes.
   */
  async ensureYearExists(anio: number, moneda: string): Promise<MonthlyIncome[]> {
    const existing = await this.listByYear(anio);
    const existingMonths = new Set(existing.map((r) => r.mes));

    const ts = now();
    const newRows: NewMonthlyIncome[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      if (!existingMonths.has(mes)) {
        newRows.push({
          id: newId(),
          anio,
          mes,
          salario: 0,
          bonus: 0,
          otros: 0,
          moneda,
          notas: null,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        });
      }
    }

    if (newRows.length > 0) {
      await this.db.insert(monthlyIncomes).values(newRows);
    }

    return this.listByYear(anio);
  }

  /**
   * Soft delete por (anio, mes). En la practica rara vez se usa: lo normal
   * es poner los valores a 0. Pero por consistencia con otros repos lo
   * incluimos.
   */
  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(monthlyIncomes)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(monthlyIncomes.id, id));
  }
}
