/**
 * src/lib/services/trash-service.ts
 *
 * Lote 10a-2: eliminados los tipos 'expenses' y 'extraIncomes' de la
 * papelera. En su lugar, un tipo unico 'movements'.
 */

import { eq, isNotNull, sql } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  categories,
  accounts,
  investments,
  goals,
  mortgage,
  otherDebts,
  movements,
} from "@/lib/db/schema";

export type TrashItemType =
  | "movements"
  | "categories"
  | "accounts"
  | "investments"
  | "goals"
  | "mortgage"
  | "otherDebts";

export type TrashItem = {
  id: string;
  type: TrashItemType;
  displayName: string;
  subtitle?: string;
  deletedAt: Date;
};

export type TrashCounts = Record<TrashItemType, number>;

export class TrashService {
  constructor(private db: DrizzleDb) {}

  async counts(): Promise<TrashCounts> {
    const [movCount, catCount, accCount, invCount, goalCount, mortCount, debtCount] =
      await Promise.all([
        this.countTable("movements"),
        this.countTable("categories"),
        this.countTable("accounts"),
        this.countTable("investments"),
        this.countTable("goals"),
        this.countTable("mortgage"),
        this.countTable("otherDebts"),
      ]);

    return {
      movements: movCount,
      categories: catCount,
      accounts: accCount,
      investments: invCount,
      goals: goalCount,
      mortgage: mortCount,
      otherDebts: debtCount,
    };
  }

  async totalCount(): Promise<number> {
    const counts = await this.counts();
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }

  async listByType(type: TrashItemType): Promise<TrashItem[]> {
    switch (type) {
      case "movements": {
        const rows = await this.db
          .select()
          .from(movements)
          .where(isNotNull(movements.deletedAt));
        return rows.map((r) => ({
          id: r.id,
          type,
          displayName: r.concepto,
          subtitle: `${r.tipo} · ${r.importe.toFixed(2)} ${r.moneda}`,
          deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt!),
        }));
      }
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

  async restore(type: TrashItemType, id: string): Promise<void> {
    const table = this.tableFor(type);
    await this.db
      .update(table)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(table.id, id));
  }

  async hardDelete(type: TrashItemType, id: string): Promise<void> {
    const table = this.tableFor(type);
    await this.db.delete(table).where(eq(table.id, id));
  }

  async emptyAll(): Promise<void> {
    const types: TrashItemType[] = [
      "movements",
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

  private tableFor(type: TrashItemType) {
    switch (type) {
      case "movements": return movements;
      case "categories": return categories;
      case "accounts": return accounts;
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
