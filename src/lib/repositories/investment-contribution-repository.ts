/**
 * ============================================================================
 *  src/lib/repositories/investment-contribution-repository.ts
 * ============================================================================
 *
 *  CRUD de aportaciones (investment_contributions). La logica que ademas crea
 *  el movimiento de salida de la cuenta y recalcula los totales de la inversion
 *  vive en InvestmentContributionService; este repo es solo acceso a datos.
 * ============================================================================
 */

import { and, asc, eq, isNull } from "drizzle-orm";
import {
  investmentContributions,
  type InvestmentContribution,
  type NewInvestmentContribution,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type CreateContributionData = Omit<
  NewInvestmentContribution,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
> & {
  // Opcional: id explicito (DETERMINISTA) para aportaciones periodicas
  // auto-generadas, para que no se dupliquen al sincronizar entre dispositivos.
  id?: string;
};

export type UpdateContributionData = Partial<
  Omit<CreateContributionData, "investmentId" | "esRetirada">
>;

export class InvestmentContributionRepository extends BaseRepository {
  /** Aportaciones activas de una inversion, mas antiguas primero. */
  async listByInvestment(
    investmentId: string,
  ): Promise<InvestmentContribution[]> {
    return this.db
      .select()
      .from(investmentContributions)
      .where(
        and(
          eq(investmentContributions.investmentId, investmentId),
          isNull(investmentContributions.deletedAt),
        ),
      )
      .orderBy(asc(investmentContributions.fecha));
  }

  /** Todas las aportaciones activas (para el grafico global), por fecha. */
  async listAll(): Promise<InvestmentContribution[]> {
    return this.db
      .select()
      .from(investmentContributions)
      .where(isNull(investmentContributions.deletedAt))
      .orderBy(asc(investmentContributions.fecha));
  }

  async getById(id: string): Promise<InvestmentContribution | null> {
    const rows = await this.db
      .select()
      .from(investmentContributions)
      .where(eq(investmentContributions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateContributionData): Promise<InvestmentContribution> {
    const ts = now();
    const id = data.id ?? newId();
    await this.db.insert(investmentContributions).values({
      ...data,
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });
    const created = await this.getById(id);
    if (!created) {
      throw new Error(
        "InvestmentContributionRepository.create: post-insert read failed",
      );
    }
    return created;
  }

  async update(
    id: string,
    patch: UpdateContributionData,
  ): Promise<InvestmentContribution> {
    await this.db
      .update(investmentContributions)
      .set({ ...patch, updatedAt: now() })
      .where(eq(investmentContributions.id, id));
    const updated = await this.getById(id);
    if (!updated)
      throw new Error(
        `InvestmentContributionRepository.update: id ${id} no existe`,
      );
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(investmentContributions)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(investmentContributions.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(investmentContributions)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(investmentContributions.id, id));
  }

  /**
   * Borrado FISICO por id. Para COMPENSAR (rollback) una operacion multi-paso
   * que fallo: la aportacion recien creada no debe dejar rastro.
   */
  async hardDelete(id: string): Promise<void> {
    await this.db
      .delete(investmentContributions)
      .where(eq(investmentContributions.id, id));
  }

  /** Todas las aportaciones de una inversion (activas y borradas). */
  async listAllByInvestment(
    investmentId: string,
  ): Promise<InvestmentContribution[]> {
    return this.db
      .select()
      .from(investmentContributions)
      .where(eq(investmentContributions.investmentId, investmentId))
      .orderBy(asc(investmentContributions.fecha));
  }

  /** Borrado fisico de todas las aportaciones de una inversion (papelera). */
  async hardDeleteByInvestment(investmentId: string): Promise<void> {
    await this.db
      .delete(investmentContributions)
      .where(eq(investmentContributions.investmentId, investmentId));
  }
}
