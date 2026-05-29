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

    // Valor actual ANTES y el importe aportado: el valor actual sube por lo
    // aportado (si aportas 100, el valor actual aumenta 100).
    const valorAntes = investment.precioActual * investment.participaciones;
    const importeAportado = args.participaciones * args.precioUnitario;

    // Movimiento de salida: transferencia con solo cuenta de origen (sin
    // destino). Baja el saldo de la cuenta y es neutral a gastos/ingresos.
    let movimientoId: string | null = null;
    if (args.cuentaOrigenId) {
      const importe = importeAportado;
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

    await this.recomputeWithValue(
      args.investmentId,
      valorAntes + importeAportado,
    );
  }

  /**
   * Borra una aportacion y DEVUELVE el importe aportado a una cuenta.
   *
   * - Deshace el movimiento de salida original (devuelve el importe a la cuenta
   *   de origen).
   * - Si `refundAccountId` es OTRA cuenta distinta del origen, ademas mueve el
   *   importe de la cuenta de origen a la elegida (transferencia).
   * - Si la aportacion no tenia movimiento (p.ej. la inicial migrada, que nunca
   *   desconto de ninguna cuenta), no se mueve dinero.
   *
   * Solo se devuelve el importe APORTADO (participaciones x precio), nunca las
   * ganancias.
   */
  async deleteContribution(
    id: string,
    refundAccountId?: string | null,
  ): Promise<void> {
    const contribution = await this.contributions.getById(id);
    if (!contribution) return;

    const investment = await this.investments.getById(contribution.investmentId);
    const valorAntes = investment
      ? investment.precioActual * investment.participaciones
      : 0;
    const importeQuitado =
      contribution.participaciones * contribution.precioUnitario;

    if (contribution.movimientoId) {
      // Deshacer el descuento original: el importe vuelve a la cuenta de origen.
      await this.movements.softDelete(contribution.movimientoId);

      // Devolver a OTRA cuenta: mover el importe de la cuenta de origen a ella.
      if (refundAccountId && refundAccountId !== contribution.cuentaOrigenId) {
        const importe = importeQuitado;
        const fecha = new Date();
        const { mes, anio } = extractPeriod(fecha);
        await this.movements.create({
          tipo: "transferencia",
          fecha,
          concepto: `Devolucion de ${investment?.nombre ?? "inversion"}`,
          importe,
          moneda: investment?.moneda ?? "EUR",
          cuentaOrigenId: contribution.cuentaOrigenId,
          cuentaDestinoId: refundAccountId,
          categoriaId: null,
          categoriaTexto: null,
          mes,
          anio,
          notas: null,
          esAutomatico: false,
          origenAutomatico: null,
          origenAutomaticoId: null,
        });
      }
    }

    await this.contributions.softDelete(id);
    // El valor actual baja por lo quitado (sin bajar de 0).
    await this.recomputeWithValue(
      contribution.investmentId,
      Math.max(0, valorAntes - importeQuitado),
    );
  }

  /**
   * Borra una inversion COMPLETA devolviendo el dinero: revierte el movimiento
   * de salida de cada aportacion (el importe vuelve a su cuenta de origen),
   * borra las aportaciones y manda la inversion a la papelera.
   */
  async deleteInvestment(investmentId: string): Promise<void> {
    const contribs = await this.contributions.listByInvestment(investmentId);
    for (const c of contribs) {
      if (c.movimientoId) {
        await this.movements.softDelete(c.movimientoId);
      }
      await this.contributions.softDelete(c.id);
    }
    await this.investments.softDelete(investmentId);
  }

  /**
   * Restaura una inversion desde la papelera: reactiva sus aportaciones y
   * vuelve a aplicar sus movimientos de salida (el dinero se descuenta otra vez
   * de las cuentas), y recalcula los totales.
   */
  async restoreInvestment(investmentId: string): Promise<void> {
    await this.investments.restore(investmentId);
    const all = await this.contributions.listAllByInvestment(investmentId);
    for (const c of all) {
      if (c.deletedAt) {
        await this.contributions.restore(c.id);
        if (c.movimientoId) {
          await this.movements.restore(c.movimientoId);
        }
      }
    }
    await this.recompute(investmentId);
  }

  /**
   * Borrado definitivo de una inversion (vaciar papelera): elimina antes sus
   * aportaciones para no violar la foreign key.
   */
  async hardDeleteInvestment(investmentId: string): Promise<void> {
    await this.contributions.hardDeleteByInvestment(investmentId);
    await this.investments.hardDelete(investmentId);
  }

  /**
   * Como recompute() pero ademas fija el VALOR ACTUAL total objetivo: ajusta
   * precioActual = targetValor / participaciones. Se usa al aportar/borrar para
   * que el valor actual suba/baje exactamente por el importe aportado.
   */
  private async recomputeWithValue(
    investmentId: string,
    targetValor: number,
  ): Promise<void> {
    const rows = await this.contributions.listByInvestment(investmentId);
    const { participaciones, precioMedio } =
      recomputeTotalsFromContributions(rows);
    const precioActual = participaciones > 0 ? targetValor / participaciones : 0;
    await this.investments.update(investmentId, {
      participaciones,
      precioCompra: precioMedio,
      precioActual,
    });
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
