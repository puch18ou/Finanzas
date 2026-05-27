/**
 * ============================================================================
 *  src/lib/services/mortgage-debt-sync-service.ts — FIX 11c
 * ============================================================================
 *
 *  CAMBIOS RESPECTO A 11c:
 *
 *  1. Si hay multiples reglas vivas para el mismo origen (bug previo),
 *     consolidamos: actualizamos la mas reciente y soft-deleteamos las demas.
 *
 *  2. Usamos `mortgage.cuentaPagoId` (campo nuevo) para rellenar
 *     cuentaOrigenId de la regla.
 *
 *  3. Categoria: buscamos categoria por nombre "Vivienda" (para hipoteca) o
 *     "Prestamos" (para deudas) al crear la regla. Si existe, usamos
 *     categoriaId; si no, fallback a categoriaTexto.
 *
 *  4. Cuando cambia el importe O la cuenta O la categoria de una regla,
 *     ACTUALIZAMOS LOS MOVEMENTS GENERADOS PARA EL MES ACTUAL y FUTUROS.
 *     Los meses pasados se conservan (historico real).
 * ============================================================================
 */

import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import type { Mortgage, OtherDebt, RecurringRule } from "@/lib/db/schema";
import { categories, movements } from "@/lib/db/schema";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import type { RecurringRuleRepository } from "@/lib/repositories/recurring-rule-repository";
import type { RecurringService } from "./recurring-service";
import { summarizeMortgage } from "@/lib/domain/mortgage";
import { calculateDebtMonthlyPayment } from "@/lib/domain/debt";

export class MortgageDebtSyncService {
  constructor(
    private rulesRepo: RecurringRuleRepository,
    private recurringService: RecurringService,
    private db: DrizzleDb,
  ) {}

  // ==========================================================================
  //  HIPOTECA
  // ==========================================================================

  async onMortgageUpserted(mortgage: Mortgage): Promise<void> {
    const cuotaMensual = this.computeMortgagePayment(mortgage);
    const categoriaViviendaId = await this.findCategoryIdByName("Vivienda");

    // Consolidamos reglas duplicadas (si las hubiera)
    const existing = await this.consolidateRules("mortgage", mortgage.id);

    const fechaInicio =
      mortgage.fechaInicio instanceof Date
        ? mortgage.fechaInicio
        : new Date(mortgage.fechaInicio);

    if (!mortgage.activa) {
      if (existing && existing.activa) {
        await this.rulesRepo.update(existing.id, { activa: false });
      }
      return;
    }

    const cuentaPagoId = mortgage.cuentaPagoId ?? null;

    if (existing) {
      await this.rulesRepo.update(existing.id, {
        nombre: "Cuota hipoteca",
        importe: cuotaMensual,
        moneda: mortgage.moneda,
        cuentaOrigenId: cuentaPagoId,
        categoriaId: categoriaViviendaId,
        categoriaTexto: categoriaViviendaId ? null : "Hipoteca",
        diaDelMes: this.dayForMortgage(mortgage),
        fechaInicio,
        activa: true,
      });
      // Sincronizar movements del mes actual y futuros
      await this.syncFutureMovementsForRule(existing.id, {
        importe: cuotaMensual,
        moneda: mortgage.moneda,
        cuentaOrigenId: cuentaPagoId,
        categoriaId: categoriaViviendaId,
        categoriaTexto: categoriaViviendaId ? null : "Hipoteca",
      });
    } else {
      await this.rulesRepo.create({
        nombre: "Cuota hipoteca",
        tipoMovimiento: "cuota",
        importe: cuotaMensual,
        moneda: mortgage.moneda,
        cuentaOrigenId: cuentaPagoId,
        cuentaDestinoId: null,
        categoriaId: categoriaViviendaId,
        categoriaTexto: categoriaViviendaId ? null : "Hipoteca",
        diaDelMes: this.dayForMortgage(mortgage),
        fechaInicio,
        fechaFin: null,
        activa: true,
        origenAutomatico: "mortgage",
        origenAutomaticoId: mortgage.id,
        notas: null,
      });
    }
  }

  async onMortgageDeleted(mortgageId: string): Promise<void> {
    const existing = await this.rulesRepo.listByOrigen("mortgage", mortgageId);
    for (const rule of existing) {
      await this.recurringService.softDeleteMovementsForRule(rule.id);
      await this.rulesRepo.softDelete(rule.id);
    }
  }

  // ==========================================================================
  //  DEUDAS
  // ==========================================================================

  async onDebtCreated(debt: OtherDebt): Promise<void> {
    await this.upsertDebtRule(debt);
  }

  async onDebtUpdated(debt: OtherDebt): Promise<void> {
    await this.upsertDebtRule(debt);
  }

  async onDebtDeleted(debtId: string): Promise<void> {
    const existing = await this.rulesRepo.listByOrigen("debt", debtId);
    for (const rule of existing) {
      await this.recurringService.softDeleteMovementsForRule(rule.id);
      await this.rulesRepo.softDelete(rule.id);
    }
  }

  private async upsertDebtRule(debt: OtherDebt): Promise<void> {
    const cuotaMensual = calculateDebtMonthlyPayment(
      debt.capitalPendiente,
      debt.tin,
      debt.plazoRestanteMeses,
    );

    const categoriaPrestamosId =
      (await this.findCategoryIdByName("Préstamos")) ||
      (await this.findCategoryIdByName("Prestamos")) ||
      (await this.findCategoryIdByName("Deudas"));

    const existing = await this.consolidateRules("debt", debt.id);

    const fechaInicio = debt.fechaInicio
      ? debt.fechaInicio instanceof Date
        ? debt.fechaInicio
        : new Date(debt.fechaInicio)
      : new Date();

    if (cuotaMensual <= 0 || debt.plazoRestanteMeses <= 0) {
      if (existing && existing.activa) {
        await this.rulesRepo.update(existing.id, { activa: false });
      }
      return;
    }

    const dia = fechaInicio.getUTCDate() || 1;
    const cuentaPagoId = debt.cuentaPagoId ?? null;

    if (existing) {
      await this.rulesRepo.update(existing.id, {
        nombre: `Cuota ${debt.concepto}`,
        importe: cuotaMensual,
        moneda: debt.moneda,
        cuentaOrigenId: cuentaPagoId,
        categoriaId: categoriaPrestamosId,
        categoriaTexto: categoriaPrestamosId ? null : debt.concepto,
        diaDelMes: dia,
        fechaInicio,
        activa: true,
      });
      await this.syncFutureMovementsForRule(existing.id, {
        importe: cuotaMensual,
        moneda: debt.moneda,
        cuentaOrigenId: cuentaPagoId,
        categoriaId: categoriaPrestamosId,
        categoriaTexto: categoriaPrestamosId ? null : debt.concepto,
      });
    } else {
      await this.rulesRepo.create({
        nombre: `Cuota ${debt.concepto}`,
        tipoMovimiento: "cuota",
        importe: cuotaMensual,
        moneda: debt.moneda,
        cuentaOrigenId: cuentaPagoId,
        cuentaDestinoId: null,
        categoriaId: categoriaPrestamosId,
        categoriaTexto: categoriaPrestamosId ? null : debt.concepto,
        diaDelMes: dia,
        fechaInicio,
        fechaFin: null,
        activa: true,
        origenAutomatico: "debt",
        origenAutomaticoId: debt.id,
        notas: null,
      });
    }
  }

  // ==========================================================================
  //  Helpers internos
  // ==========================================================================

  /**
   * Busca categoria por nombre exacto (no borrada). Devuelve id o null.
   */
  private async findCategoryIdByName(nombre: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.nombre, nombre), isNull(categories.deletedAt)))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  /**
   * Si hay multiples reglas vivas para el mismo origen, conserva la mas
   * reciente y soft-deletea las demas. Devuelve la "ganadora" o null.
   */
  private async consolidateRules(
    origen: "mortgage" | "debt" | "interest",
    origenId: string,
  ): Promise<RecurringRule | null> {
    const existing = await this.rulesRepo.listByOrigen(origen, origenId);
    if (existing.length === 0) return null;
    if (existing.length === 1) return existing[0] ?? null;

    // Ordenar por createdAt descendente (mas reciente primero)
    const sorted = [...existing].sort((a, b) => {
      const ta =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : new Date(a.createdAt).getTime();
      const tb =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : new Date(b.createdAt).getTime();
      return tb - ta;
    });
    const winner = sorted[0] ?? null;
    if (!winner) return null;
    const losers = sorted.slice(1);

    for (const loser of losers) {
      await this.recurringService.softDeleteMovementsForRule(loser.id);
      await this.rulesRepo.softDelete(loser.id);
    }
    return winner;
  }

  /**
   * Actualiza los movements ya generados por una regla que correspondan
   * al MES ACTUAL o FUTURO. Los meses pasados se conservan tal cual.
   */
  private async syncFutureMovementsForRule(
    ruleId: string,
    patch: {
      importe: number;
      moneda: string;
      cuentaOrigenId: string | null;
      categoriaId: string | null;
      categoriaTexto: string | null;
    },
  ): Promise<void> {
    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActual = now.getMonth() + 1;

    await this.db
      .update(movements)
      .set({
        importe: patch.importe,
        moneda: patch.moneda,
        cuentaOrigenId: patch.cuentaOrigenId,
        categoriaId: patch.categoriaId,
        categoriaTexto: patch.categoriaTexto,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(movements.origenAutomaticoId, ruleId),
          isNull(movements.deletedAt),
          // mes actual o futuro
          or(
            gte(movements.anio, anioActual + 1),
            and(eq(movements.anio, anioActual), gte(movements.mes, mesActual)),
          ),
        ),
      );
  }

  private computeMortgagePayment(m: Mortgage): number {
    const summary = summarizeMortgage({
      precioVivienda: m.precioVivienda,
      entrada: m.entrada,
      gastosAsociados: m.gastosAsociados,
      plazoAnios: m.plazoAnios,
      tin: m.tin,
    });
    return summary.cuotaMensual;
  }

  private dayForMortgage(m: Mortgage): number {
    const f =
      m.fechaInicio instanceof Date ? m.fechaInicio : new Date(m.fechaInicio);
    const d = f.getUTCDate();
    return d >= 1 && d <= 31 ? d : 1;
  }
}
