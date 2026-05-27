/**
 * ============================================================================
 *  src/lib/services/trash-service.ts
 * ============================================================================
 *
 *  Servicio unificado para la papelera. Centraliza:
 *    - Contar todos los elementos soft-deleted (suma de tablas)
 *    - Listar por tipo
 *    - Restaurar (poner deletedAt = null)
 *    - Borrar definitivamente (DELETE fisico)
 *
 *  POR QUE UN SERVICE Y NO TOCAR LOS REPOS
 *  ---------------------------------------
 *  Los repos individuales ya tienen list(), softDelete() y -casi todos-
 *  restore(). Pero les falta hardDelete() en muchos casos. En vez de tocar
 *  los 11 repos uno a uno (riesgo de romper cosas), creamos un servicio
 *  que opera DIRECTAMENTE sobre las tablas via Drizzle. Es leve, autonomo,
 *  y no afecta al codigo existente.
 *
 *  La papelera no necesita logica de negocio compleja (no convierte
 *  monedas, no aplica reglas), solo CRUD basico. Drizzle directo es
 *  perfecto para este caso.
 *
 *  TIPOS DE ELEMENTOS
 *  ------------------
 *  Los tipos siguen la convencion plural usada en el resto de la app y
 *  que el usuario reconoce en el sidebar:
 *    - categories, accounts, expenses, monthlyIncomes, extraIncomes,
 *      investments, goals, mortgage, otherDebts
 *
 *  monthlyIncomes NO se incluye en la papelera porque su soft-delete no
 *  tiene sentido (siempre se crea una fila por (anio, mes) y se edita,
 *  nunca se borra realmente).
 * ============================================================================
 */

import { eq, isNotNull, sql } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  categories,
  accounts,
  expenses,
  extraIncomes,
  investments,
  goals,
  mortgage,
  otherDebts,
} from "@/lib/db/schema";

export type TrashItemType =
  | "categories"
  | "accounts"
  | "expenses"
  | "extraIncomes"
  | "investments"
  | "goals"
  | "mortgage"
  | "otherDebts";

/**
 * Una fila normalizada para mostrar en la tabla de la papelera. Cada
 * tipo de elemento se "aplana" a este shape comun para que la UI sea
 * una sola tabla.
 */
export type TrashItem = {
  id: string;
  type: TrashItemType;
  /** Nombre/descripcion para mostrar en la primera columna */
  displayName: string;
  /** Subtitulo opcional (e.g. importe, fecha original...) */
  subtitle?: string;
  /** Fecha en la que se borro */
  deletedAt: Date;
};

export type TrashCounts = Record<TrashItemType, number>;

export class TrashService {
  constructor(private db: DrizzleDb) {}

  /**
   * Cuenta los elementos en papelera por tipo.
   */
  async counts(): Promise<TrashCounts> {
    const [
      catCount,
      accCount,
      expCount,
      extCount,
      invCount,
      goalCount,
      mortCount,
      debtCount,
    ] = await Promise.all([
      this.countTable("categories"),
      this.countTable("accounts"),
      this.countTable("expenses"),
      this.countTable("extraIncomes"),
      this.countTable("investments"),
      this.countTable("goals"),
      this.countTable("mortgage"),
      this.countTable("otherDebts"),
    ]);

    return {
      categories: catCount,
      accounts: accCount,
      expenses: expCount,
      extraIncomes: extCount,
      investments: invCount,
      goals: goalCount,
      mortgage: mortCount,
      otherDebts: debtCount,
    };
  }

  /**
   * Total de elementos en papelera (suma de todos los tipos). Util para
   * el badge del sidebar.
   */
  async totalCount(): Promise<number> {
    const counts = await this.counts();
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }

  /**
   * Lista los elementos de un tipo en la papelera, en formato normalizado.
   */
  async listByType(type: TrashItemType): Promise<TrashItem[]> {
    switch (type) {
      case "categories": {
        const rows = await this.db
          .select()
          .from(categories)
          .where(isNotNull(categories.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.nombre,
          subtitle: r.tipo,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "accounts": {
        const rows = await this.db
          .select()
          .from(accounts)
          .where(isNotNull(accounts.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.alias,
          subtitle: `${r.entidad} · ${r.tipo}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "expenses": {
        const rows = await this.db
          .select()
          .from(expenses)
          .where(isNotNull(expenses.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.concepto,
          subtitle: `${r.importe.toFixed(2)} ${r.moneda}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "extraIncomes": {
        const rows = await this.db
          .select()
          .from(extraIncomes)
          .where(isNotNull(extraIncomes.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.concepto,
          subtitle: `${r.importe.toFixed(2)} ${r.moneda}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "investments": {
        const rows = await this.db
          .select()
          .from(investments)
          .where(isNotNull(investments.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.nombre,
          subtitle: r.ticker ? `${r.ticker} · ${r.tipo}` : r.tipo,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "goals": {
        const rows = await this.db
          .select()
          .from(goals)
          .where(isNotNull(goals.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.nombre,
          subtitle: `${r.yaAhorrado.toFixed(0)}/${r.importeObjetivo.toFixed(0)} ${r.moneda}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "mortgage": {
        const rows = await this.db
          .select()
          .from(mortgage)
          .where(isNotNull(mortgage.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: `Hipoteca ${r.tipo}`,
          subtitle: `${r.precioVivienda.toFixed(0)} ${r.moneda} · ${r.plazoAnios} anios`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
      case "otherDebts": {
        const rows = await this.db
          .select()
          .from(otherDebts)
          .where(isNotNull(otherDebts.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.concepto,
          subtitle: `${r.capitalPendiente.toFixed(0)} ${r.moneda} · ${r.tipo}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
    }
  }

  /**
   * Restaura un elemento (deletedAt = null).
   */
  async restore(type: TrashItemType, id: string): Promise<void> {
    const table = this.tableFor(type);
    await this.db
      .update(table)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(table.id, id));
  }

  /**
   * Borrado FISICO. Esto es definitivo, no hay vuelta atras.
   *
   * AVISO: si la fila tiene foreign keys de otras tablas activas
   * (e.g. una categoria borrada pero que aun referencian gastos
   * activos), el borrado fallara por integridad referencial. Es lo
   * deseado: protege contra "huerfanos" en cascada.
   */
  async hardDelete(type: TrashItemType, id: string): Promise<void> {
    const table = this.tableFor(type);
    await this.db.delete(table).where(eq(table.id, id));
  }

  /**
   * Vacia toda la papelera (hard-delete masivo). Para el boton de
   * "Vaciar papelera" tras confirmacion.
   */
  async emptyAll(): Promise<void> {
    const types: TrashItemType[] = [
      "expenses",
      "extraIncomes",
      "investments",
      "goals",
      "otherDebts",
      "categories",
      "accounts",
      "mortgage",
    ];
    for (const t of types) {
      const table = this.tableFor(t);
      await this.db.delete(table).where(isNotNull(table.deletedAt));
    }
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private tableFor(type: TrashItemType) {
    switch (type) {
      case "categories": return categories;
      case "accounts": return accounts;
      case "expenses": return expenses;
      case "extraIncomes": return extraIncomes;
      case "investments": return investments;
      case "goals": return goals;
      case "mortgage": return mortgage;
      case "otherDebts": return otherDebts;
    }
  }

  private async countTable(type: TrashItemType): Promise<number> {
    const table = this.tableFor(type);
    const result = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(table)
      .where(isNotNull(table.deletedAt));
    return Number(result[0]?.c ?? 0);
  }
}
