/**
 * ============================================================================
 *  src/lib/services/investment-contribution-service.ts
 * ============================================================================
 *
 *  Orquesta las aportaciones a una inversion (Lote 13):
 *
 *    addContribution()    inserta la aportacion, opcionalmente crea un
 *                         movimiento de salida (transferencia desde la cuenta
 *                         de origen hacia la cuenta-broker de la inversion) y
 *                         recalcula los totales cacheados del investment.
 *
 *    deleteContribution() borra (soft) la aportacion y su movimiento asociado,
 *                         y recalcula los totales.
 *
 *  El movimiento es una TRANSFERENCIA de salida (solo cuenta de origen, sin
 *  destino): baja el saldo de esa cuenta y es neutral a gastos/ingresos (el
 *  dinero no se gasta, pasa a ser un activo). Solo se crea si hay cuenta de
 *  origen; si no, la aportacion se registra sin afectar a ningun saldo.
 * ============================================================================
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { InvestmentRepository } from "@/lib/repositories/investment-repository";
import { MovementRepository } from "@/lib/repositories/movement-repository";
import { InvestmentContributionRepository } from "@/lib/repositories/investment-contribution-repository";
import { recomputeTotalsFromContributions } from "@/lib/domain/investments";
import { extractPeriod } from "@/lib/utils/dates";

export type AddContributionArgs = {
  investmentId: string;
  fecha: Date;
  participaciones: number;
  precioUnitario: number;
  /** Cuenta de la que sale el dinero. Si se indica, se crea el movimiento. */
  cuentaOrigenId?: string | null;
  notas?: string | null;
};

export class InvestmentContributionService {
  private investments: InvestmentRepository;
  private movements: MovementRepository;
  private contributions: InvestmentContributionRepository;

  constructor(private db: DrizzleDb) {
    this.investments = new InvestmentRepository(db);
    this.movements = new MovementRepository(db);
    this.contributions = new InvestmentContributionRepository(db);
  }

  async addContribution(args: AddContributionArgs): Promise<void> {
    const investment = await this.investments.getById(args.investmentId);
    if (!investment) {
      throw new Error("La inversion no existe.");
    }

    // Movimiento de salida: transferencia con solo cuenta de origen (sin
    // destino). Baja el saldo de la cuenta y es neutral a gastos/ingresos.
    let movimientoId: string | null = null;
    if (args.cuentaOrigenId) {
      const importe = args.participaciones * args.precioUnitario;
      const { mes, anio } = extractPeriod(args.fecha);
      const mov = await this.movements.create({
        tipo: "transferencia",
        fecha: args.fecha,
        concepto: `Aportacion a ${investment.nombre}`,
        importe,
        moneda: investment.moneda,
        cuentaOrigenId: args.cuentaOrigenId,
        cuentaDestinoId: null,
        categoriaId: null,
        categoriaTexto: null,
        mes,
        anio,
        notas: null,
        esAutomatico: false,
        origenAutomatico: null,
        origenAutomaticoId: null,
      });
      movimientoId = mov.id;
    }

    await this.contributions.create({
      investmentId: args.investmentId,
      fecha: args.fecha,
      participaciones: args.participaciones,
      precioUnitario: args.precioUnitario,
      cuentaOrigenId: args.cuentaOrigenId ?? null,
      movimientoId,
      notas: args.notas ?? null,
    });

    await this.recompute(args.investmentId);
  }

  async deleteContribution(id: string): Promise<void> {
    const contribution = await this.contributions.getById(id);
    if (!contribution) return;

    if (contribution.movimientoId) {
      await this.movements.softDelete(contribution.movimientoId);
    }
    await this.contributions.softDelete(id);
    await this.recompute(contribution.investmentId);
  }

  /** Recalcula participaciones y coste medio del investment desde sus aportaciones. */
  private async recompute(investmentId: string): Promise<void> {
    const rows = await this.contributions.listByInvestment(investmentId);
    const { participaciones, precioMedio } =
      recomputeTotalsFromContributions(rows);
    await this.investments.update(investmentId, {
      participaciones,
      precioCompra: precioMedio,
    });
  }
}
