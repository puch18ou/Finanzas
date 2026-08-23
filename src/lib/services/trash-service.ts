/**
 * src/lib/services/trash-service.ts
 *
 * Lote 10a-2: eliminados los tipos 'expenses' y 'extraIncomes' de la
 * papelera. En su lugar, un tipo unico 'movements'.
 */

import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  categories,
  accounts,
  investments,
  investmentContributions,
  goals,
  mortgage,
  otherDebts,
  movements,
  recurringRules,
} from "@/lib/db/schema";
import type { SyncTable } from "@/lib/domain/sync";
import { InvestmentContributionService } from "./investment-contribution-service";
import { TombstoneRepository } from "@/lib/repositories/tombstone-repository";

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
  private contributionService: InvestmentContributionService;
  private tombstones: TombstoneRepository;

  constructor(private db: DrizzleDb) {
    this.contributionService = new InvestmentContributionService(db);
    this.tombstones = new TombstoneRepository(db);
  }

  /** Mapea el tipo de papelera al nombre de tabla que entiende la sync. */
  private syncTableFor(type: TrashItemType): SyncTable {
    return type === "otherDebts" ? "other_debts" : type;
  }

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
    // Inversiones: reactiva tambien sus aportaciones y vuelve a aplicar sus
    // movimientos de salida (re-descuenta de las cuentas) + recalcula.
    if (type === "investments") {
      await this.contributionService.restoreInvestment(id);
      return;
    }
    const table = this.tableFor(type);
    await this.db
      .update(table)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(table.id, id));
  }

  async hardDelete(type: TrashItemType, id: string): Promise<void> {
    // Inversiones: borra antes sus aportaciones (FK) y deja lapida de ambas.
    if (type === "investments") {
      const contribs = await this.db
        .select({ id: investmentContributions.id })
        .from(investmentContributions)
        .where(eq(investmentContributions.investmentId, id));
      await this.contributionService.hardDeleteInvestment(id);
      await this.tombstones.recordMany(
        contribs.map((c) => c.id),
        "investment_contributions",
      );
      await this.tombstones.record(id, "investments");
      return;
    }
    // Antes de un borrado FISICO hay que quitar las referencias (FK) que otras
    // filas tengan hacia esta (si no, SQLite rechaza el DELETE). Como el
    // elemento esta en la papelera, esas referencias son de otras filas ya
    // borradas o descolgadas: anularlas es seguro.
    if (type === "movements") await this.nullRefsToMovements([id]);
    if (type === "accounts") await this.nullRefsToAccounts([id]);
    if (type === "categories") await this.nullRefsToCategories([id]);

    const table = this.tableFor(type);
    await this.db.delete(table).where(eq(table.id, id));
    // Lapida para que el borrado se propague por sync (no resucite en otro
    // dispositivo).
    await this.tombstones.record(id, this.syncTableFor(type));
  }

  /** Anula las referencias (FK) de otras tablas hacia estos movimientos. */
  private async nullRefsToMovements(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(investmentContributions)
      .set({ movimientoId: null })
      .where(inArray(investmentContributions.movimientoId, ids));
  }

  /** Anula las referencias (FK) de otras tablas hacia estas cuentas. */
  private async nullRefsToAccounts(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(movements)
      .set({ cuentaOrigenId: null })
      .where(inArray(movements.cuentaOrigenId, ids));
    await this.db
      .update(movements)
      .set({ cuentaDestinoId: null })
      .where(inArray(movements.cuentaDestinoId, ids));
    await this.db
      .update(recurringRules)
      .set({ cuentaOrigenId: null })
      .where(inArray(recurringRules.cuentaOrigenId, ids));
    await this.db
      .update(recurringRules)
      .set({ cuentaDestinoId: null })
      .where(inArray(recurringRules.cuentaDestinoId, ids));
    await this.db
      .update(investmentContributions)
      .set({ cuentaOrigenId: null })
      .where(inArray(investmentContributions.cuentaOrigenId, ids));
    await this.db
      .update(otherDebts)
      .set({ cuentaPagoId: null })
      .where(inArray(otherDebts.cuentaPagoId, ids));
    await this.db
      .update(mortgage)
      .set({ cuentaPagoId: null })
      .where(inArray(mortgage.cuentaPagoId, ids));
    await this.db
      .update(goals)
      .set({ cuentaVinculadaId: null })
      .where(inArray(goals.cuentaVinculadaId, ids));
  }

  /** Anula las referencias (FK) de otras tablas hacia estas categorias. */
  private async nullRefsToCategories(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(movements)
      .set({ categoriaId: null })
      .where(inArray(movements.categoriaId, ids));
    await this.db
      .update(recurringRules)
      .set({ categoriaId: null })
      .where(inArray(recurringRules.categoriaId, ids));
  }

  async emptyAll(): Promise<void> {
    // Inversiones primero, via servicio (borra sus aportaciones antes por la FK).
    const deletedInvs = await this.db
      .select({ id: investments.id })
      .from(investments)
      .where(isNotNull(investments.deletedAt));
    for (const inv of deletedInvs) {
      const contribs = await this.db
        .select({ id: investmentContributions.id })
        .from(investmentContributions)
        .where(eq(investmentContributions.investmentId, inv.id));
      await this.contributionService.hardDeleteInvestment(inv.id);
      await this.tombstones.recordMany(
        contribs.map((c) => c.id),
        "investment_contributions",
      );
    }
    await this.tombstones.recordMany(
      deletedInvs.map((i) => i.id),
      "investments",
    );

    // Orden FK-seguro: primero los HIJOS (movimientos, deudas, hipoteca que
    // referencian cuentas), y las cuentas/categorias al final. Ademas anulamos
    // las referencias colgantes hacia lo que vamos a borrar.
    const types: TrashItemType[] = [
      "movements",
      "goals",
      "otherDebts",
      "mortgage",
      "categories",
      "accounts",
    ];

    // Ids en papelera por tipo.
    const idsByType: Partial<Record<TrashItemType, string[]>> = {};
    for (const t of types) {
      const table = this.tableFor(t);
      const rows = await this.db
        .select({ id: table.id })
        .from(table)
        .where(isNotNull(table.deletedAt));
      idsByType[t] = rows.map((r) => r.id);
    }

    // Quitar FKs hacia lo que se va a borrar (movimientos, cuentas, categorias).
    await this.nullRefsToMovements(idsByType.movements ?? []);
    await this.nullRefsToAccounts(idsByType.accounts ?? []);
    await this.nullRefsToCategories(idsByType.categories ?? []);

    for (const t of types) {
      const table = this.tableFor(t);
      await this.db.delete(table).where(isNotNull(table.deletedAt));
      await this.tombstones.recordMany(
        idsByType[t] ?? [],
        this.syncTableFor(t),
      );
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
