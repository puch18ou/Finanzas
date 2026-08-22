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

import { and, eq, isNull } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { movements, recurringRules } from "@/lib/db/schema";
import type { RecurringRule, Investment } from "@/lib/db/schema";
import {
  InvestmentRepository,
  type CreateInvestmentData,
} from "@/lib/repositories/investment-repository";
import { MovementRepository } from "@/lib/repositories/movement-repository";
import { InvestmentContributionRepository } from "@/lib/repositories/investment-contribution-repository";
import {
  APORTACION_PERIODICA_NOTA,
  realizedGain,
  recomputeTotalsFromContributions,
  usaParticipaciones,
} from "@/lib/domain/investments";
import {
  anioMesToComparableNumber,
  buildPeriodDate,
  currentPeriod,
  isPeriodInRange,
  periodsBetween,
} from "@/lib/domain/recurring";
import { extractPeriod } from "@/lib/utils/dates";
import { autoGenId } from "@/lib/domain/auto-id";

export type AddContributionArgs = {
  investmentId: string;
  fecha: Date;
  participaciones: number;
  precioUnitario: number;
  /** Comision de compra (Lote 17). Se suma al coste y al movimiento. */
  comision?: number;
  /** Cuenta de la que sale el dinero. Si se indica, se crea el movimiento. */
  cuentaOrigenId?: string | null;
  notas?: string | null;
};

export type UpdateContributionArgs = {
  id: string;
  fecha: Date;
  participaciones: number;
  precioUnitario: number;
  /** Comision (Lote 17). Para aportacion suma al coste; para retirada lo resta. */
  comision?: number;
  /**
   * Cuenta vinculada. Para aportaciones, cuenta de origen del dinero.
   * Para retiradas, cuenta destino. Si la aportacion no tenia movimiento,
   * no se crea uno al editar; solo se actualiza la fila.
   */
  cuentaId?: string | null;
  notas?: string | null;
};

export type WithdrawArgs = {
  investmentId: string;
  /** Cuenta a la que entra el dinero retirado. */
  cuentaDestinoId: string;
  fecha: Date;
  /** Modo participaciones (Acciones/ETF/Cripto): participaciones a retirar. */
  participaciones?: number;
  /** Modo dinero (resto): importe a retirar. */
  importe?: number;
  /** Retirar toda la posicion. */
  todo?: boolean;
  /** Comision de venta (Lote 17). Reduce el dinero recibido en la cuenta. */
  comision?: number;
};

export class InvestmentContributionService {
  private investments: InvestmentRepository;
  private movements: MovementRepository;
  private contributions: InvestmentContributionRepository;

  // Repos inyectables (por defecto se crean sobre `db`). La inyeccion permite
  // testear la compensacion/atomicidad con repos falsos.
  constructor(
    private db: DrizzleDb,
    investments?: InvestmentRepository,
    movements?: MovementRepository,
    contributions?: InvestmentContributionRepository,
  ) {
    this.investments = investments ?? new InvestmentRepository(db);
    this.movements = movements ?? new MovementRepository(db);
    this.contributions = contributions ?? new InvestmentContributionRepository(db);
  }

  async addContribution(args: AddContributionArgs): Promise<void> {
    const investment = await this.investments.getById(args.investmentId);
    if (!investment) {
      throw new Error("La inversion no existe.");
    }

    // Valor actual ANTES y el importe aportado. La comision SE SUMA al coste
    // y por tanto sale tambien de la cuenta, pero NO sube el valor actual
    // (es coste hundido). En cuanto al valor actual de la inversion sube por
    // el importe efectivamente comprado (sin contar fee).
    const valorAntes = investment.precioActual * investment.participaciones;
    const importeComprado = args.participaciones * args.precioUnitario;
    const comision = Math.max(0, args.comision ?? 0);
    const importeMovimiento = importeComprado + comision;

    // Multi-paso ATOMICO: movimiento de salida (si hay cuenta) + aportacion +
    // recalculo. Si algo falla, se deshace lo creado (ver atomic()).
    await this.atomic(async (onUndo) => {
      // Movimiento de salida: transferencia con solo cuenta de origen (sin
      // destino). Baja el saldo de la cuenta y es neutral a gastos/ingresos.
      let movimientoId: string | null = null;
      if (args.cuentaOrigenId) {
        const { mes, anio } = extractPeriod(args.fecha);
        const mov = await this.movements.create({
          tipo: "transferencia",
          fecha: args.fecha,
          concepto: `Aportacion a ${investment.nombre}`,
          importe: importeMovimiento,
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
        onUndo(() => this.movements.hardDelete(mov.id));
      }

      const contrib = await this.contributions.create({
        investmentId: args.investmentId,
        fecha: args.fecha,
        participaciones: args.participaciones,
        precioUnitario: args.precioUnitario,
        comision,
        cuentaOrigenId: args.cuentaOrigenId ?? null,
        movimientoId,
        notas: args.notas ?? null,
      });
      onUndo(() => this.contributions.hardDelete(contrib.id));

      await this.recomputeWithValue(
        args.investmentId,
        valorAntes + importeComprado,
      );
    });
  }

  /**
   * Crea una inversion JUNTO con su primera aportacion, de forma ATOMICA: si la
   * aportacion falla (p.ej. el movimiento de salida no se puede crear), se
   * deshace tambien la inversion para no dejar una posicion vacia huerfana.
   *
   * (addContribution ya compensa su propio movimiento/aportacion; aqui solo
   * anadimos deshacer la inversion recien creada.)
   */
  async createWithFirstContribution(
    investmentData: CreateInvestmentData,
    contribution: Omit<AddContributionArgs, "investmentId">,
  ): Promise<Investment> {
    const inv = await this.investments.create(investmentData);
    try {
      await this.addContribution({ ...contribution, investmentId: inv.id });
    } catch (err) {
      try {
        await this.investments.hardDelete(inv.id);
      } catch (e) {
        console.error("[atomic] fallo al deshacer la inversion:", e);
      }
      throw err;
    }
    return inv;
  }

  /**
   * Retira (reembolsa) parte o todo de una inversion: el dinero ENTRA en la
   * cuenta destino, y bajan participaciones, coste y valor.
   *
   * - Modo participaciones (Acciones/ETF/Cripto): se retiran `participaciones`
   *   unidades; el dinero recibido = unidades x precio actual.
   * - Modo dinero (resto): se retira `importe` de valor.
   *
   * Se registra como una fila es_retirada=1 (participaciones positivas) para que
   * el recalculo reste; el coste se reduce al coste medio (no afecta al medio).
   */
  async withdraw(
    args: WithdrawArgs,
  ): Promise<{ plusvaliaRealizada: number; moneda: string } | null> {
    const inv = await this.investments.getById(args.investmentId);
    if (!inv) throw new Error("La inversion no existe.");

    const valorAntes = inv.precioActual * inv.participaciones;
    const conPart = usaParticipaciones(inv.tipo);

    let partRetirada: number;
    let precioUnitario: number;
    let dineroRecibido: number;

    if (conPart) {
      const n = args.todo ? inv.participaciones : args.participaciones ?? 0;
      partRetirada = Math.min(Math.max(n, 0), inv.participaciones);
      precioUnitario = inv.precioCompra; // coste medio (no mueve el medio)
      dineroRecibido = partRetirada * inv.precioActual;
    } else {
      // Modo dinero (Fondo, etc.): retiras un IMPORTE del valor actual. El
      // valor baja por ese importe; el coste baja en PROPORCION (conservas la
      // parte de ganancia). Ej: invertido 1000, valor 1200, retiras 1100 ->
      // quedan 100 de valor, coste ~83 (P/L +16,7).
      const x = args.todo ? valorAntes : args.importe ?? 0;
      dineroRecibido = Math.min(Math.max(x, 0), valorAntes);
      const fraccion = valorAntes > 0 ? dineroRecibido / valorAntes : 0;
      partRetirada = inv.participaciones * fraccion;
      precioUnitario = 1;
    }

    if (partRetirada <= 0) return null;

    // Lote 17: comision de venta reduce el dinero que entra en la cuenta;
    // el valor de la inversion baja por el bruto (lo que sale de la
    // cartera), pero a la cuenta entra el neto.
    const comision = Math.max(0, args.comision ?? 0);
    const dineroNeto = Math.max(0, dineroRecibido - comision);

    // Plusvalia/minusvalia REALIZADA: dinero recibido bruto - coste (a coste
    // medio) de las participaciones vendidas. Se guarda en la fila de retirada.
    const plusvaliaRealizada = realizedGain(
      dineroRecibido,
      partRetirada,
      inv.precioCompra,
    );

    // Multi-paso ATOMICO: entrada de dinero + fila de retirada + recalculo.
    const { mes, anio } = extractPeriod(args.fecha);
    await this.atomic(async (onUndo) => {
      // Entrada de dinero en la cuenta destino (neutral a ingresos/gastos).
      const mov = await this.movements.create({
        tipo: "transferencia",
        fecha: args.fecha,
        concepto: `Retirada de ${inv.nombre}`,
        importe: dineroNeto,
        moneda: inv.moneda,
        cuentaOrigenId: null,
        cuentaDestinoId: args.cuentaDestinoId,
        categoriaId: null,
        categoriaTexto: null,
        mes,
        anio,
        notas: null,
        esAutomatico: false,
        origenAutomatico: null,
        origenAutomaticoId: null,
      });
      onUndo(() => this.movements.hardDelete(mov.id));

      const contrib = await this.contributions.create({
        investmentId: args.investmentId,
        fecha: args.fecha,
        participaciones: partRetirada,
        precioUnitario,
        comision,
        plusvaliaRealizada,
        cuentaOrigenId: args.cuentaDestinoId,
        movimientoId: mov.id,
        esRetirada: true,
        notas: "Retirada",
      });
      onUndo(() => this.contributions.hardDelete(contrib.id));

      await this.recomputeWithValue(
        args.investmentId,
        Math.max(0, valorAntes - dineroRecibido),
      );
    });

    return { plusvaliaRealizada, moneda: inv.moneda };
  }

  /**
   * Edita una aportacion/retirada existente (Lote 18). Actualiza la fila, el
   * movimiento asociado si lo tiene, y recalcula los totales de la inversion.
   *
   * El precioActual de mercado se mantiene; el valor total se ajusta por el
   * cambio de participaciones (delta * precioActual). El esRetirada NO se
   * puede cambiar (borrar y crear de nuevo si hace falta).
   */
  async updateContribution(args: UpdateContributionArgs): Promise<void> {
    const c = await this.contributions.getById(args.id);
    if (!c) throw new Error("Aportacion no existe");
    const inv = await this.investments.getById(c.investmentId);
    if (!inv) throw new Error("Inversion no existe");

    const comision = Math.max(0, args.comision ?? 0);
    const importeMovimiento = c.esRetirada
      ? Math.max(0, args.participaciones * args.precioUnitario - comision)
      : args.participaciones * args.precioUnitario + comision;

    // Delta de participaciones aplicado al valor actual (al precio de mercado).
    // En una aportacion, mas participaciones suben el valor; en una retirada,
    // mas participaciones retiradas bajan el valor.
    const partDelta = args.participaciones - c.participaciones;
    const signo = c.esRetirada ? -1 : 1;
    const valorActualAntes = inv.precioActual * inv.participaciones;
    const valorObjetivo = Math.max(
      0,
      valorActualAntes + signo * partDelta * inv.precioActual,
    );

    // Sincroniza el movimiento asociado (si existe).
    if (c.movimientoId) {
      const { mes, anio } = extractPeriod(args.fecha);
      await this.movements.update(c.movimientoId, {
        fecha: args.fecha,
        importe: importeMovimiento,
        // En aportacion el dinero SALE de la cuenta (origen). En retirada
        // ENTRA en la cuenta (destino).
        cuentaOrigenId: c.esRetirada ? null : (args.cuentaId ?? null),
        cuentaDestinoId: c.esRetirada ? (args.cuentaId ?? null) : null,
        mes,
        anio,
      });
    }

    await this.contributions.update(args.id, {
      fecha: args.fecha,
      participaciones: args.participaciones,
      precioUnitario: args.precioUnitario,
      comision,
      cuentaOrigenId: args.cuentaId ?? null,
      notas: args.notas ?? null,
    });

    await this.recomputeWithValue(c.investmentId, valorObjetivo);
  }

  /**
   * Genera las aportaciones PERIODICAS pendientes (Lote 13b-2). Las reglas
   * de aportacion periodica se guardan en `recurring_rules` con
   * origen_automatico = 'investment' y origen_automatico_id = id de la
   * inversion. Por cada mes [fechaInicio..mes actual] que aun no tenga su
   * aportacion, crea el movimiento de salida + la fila de aportacion +
   * recalcula los totales. Idempotente: la deteccion de duplicados usa el
   * movimiento generado (origenAutomaticoId = regla, mes, anio).
   *
   * Se llama al arrancar la app, despues de RecurringService.
   */
  async generatePeriodicContributions(now: Date = new Date()): Promise<number> {
    const rules = await this.db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.origenAutomatico, "investment"),
          eq(recurringRules.activa, true),
          isNull(recurringRules.deletedAt),
        ),
      );
    if (rules.length === 0) return 0;

    let generated = 0;

    for (const rule of rules) {
      // Sin cuenta de origen no podemos garantizar idempotencia (el movimiento
      // es quien lleva la clave de cada ocurrencia), asi que no generamos.
      if (!rule.origenAutomaticoId || !rule.cuentaOrigenId) continue;

      const occurrences = buildOccurrences(rule, now);
      if (occurrences.length === 0) continue;

      // Movimientos ya generados por esta regla. La clave es por mes (mensual)
      // o por dia (semanal/diaria), segun la frecuencia.
      const existing = await this.db
        .select({ fecha: movements.fecha })
        .from(movements)
        .where(
          and(
            eq(movements.origenAutomaticoId, rule.id),
            isNull(movements.deletedAt),
          ),
        );
      const freq = investmentFrecuencia(rule.frecuencia);
      const existingKey = new Set(
        existing.map((e) =>
          occurrenceKey(
            freq,
            e.fecha instanceof Date ? e.fecha : new Date(e.fecha),
          ),
        ),
      );

      for (const fecha of occurrences) {
        if (existingKey.has(occurrenceKey(freq, fecha))) continue;
        const { mes, anio } = extractPeriod(fecha);
        const ok = await this.addPeriodicContribution(rule, fecha, mes, anio);
        if (ok) generated++;
      }
    }

    return generated;
  }

  /**
   * Registra UNA aportacion periodica para el periodo (mes, anio): crea el
   * movimiento de salida desde la cuenta de la regla y la fila de aportacion,
   * y recalcula los totales. El importe es fijo (regla.importe). En modo
   * participaciones (Acciones/ETF/Cripto) las participaciones se derivan del
   * valor actual por participacion en el momento de generarse; en modo dinero
   * (resto) participaciones = importe y precio/ud = 1.
   *
   * Devuelve true si se creo la aportacion.
   */
  private async addPeriodicContribution(
    rule: RecurringRule,
    fecha: Date,
    mes: number,
    anio: number,
  ): Promise<boolean> {
    const investmentId = rule.origenAutomaticoId;
    if (!investmentId) return false;

    // Releemos la inversion en cada periodo: al aportar cambian sus totales,
    // y el precio de referencia del siguiente mes debe partir del valor ya
    // actualizado.
    const investment = await this.investments.getById(investmentId);
    if (!investment) return false; // inversion borrada -> no generamos

    const importe = rule.importe;
    if (importe <= 0) return false;

    const valorAntes = investment.precioActual * investment.participaciones;

    let participaciones: number;
    let precioUnitario: number;
    if (usaParticipaciones(investment.tipo)) {
      const precioRef =
        investment.precioActual > 0
          ? investment.precioActual
          : investment.precioCompra > 0
            ? investment.precioCompra
            : 1;
      precioUnitario = precioRef;
      participaciones = importe / precioRef;
    } else {
      participaciones = importe;
      precioUnitario = 1;
    }

    // IDs DETERMINISTAS (misma clave que el dedup de ocurrencias): la misma
    // aportacion periodica tiene el mismo PK en todos los dispositivos, asi el
    // sync no duplica ni el movimiento ni la fila de aportacion.
    const occKey = occurrenceKey(investmentFrecuencia(rule.frecuencia), fecha);

    // ATOMICO: si fallara entre el movimiento y la aportacion, sin compensar
    // quedaria el movimiento huerfano y la idempotencia (que dedupe por el
    // movimiento) SALTARIA esta ocurrencia para siempre -> aportacion perdida.
    return this.atomic(async (onUndo) => {
      const mov = await this.movements.create({
        id: autoGenId("cmov", rule.id, occKey),
        tipo: "transferencia",
        fecha,
        concepto: `Aportacion periodica a ${investment.nombre}`,
        importe,
        moneda: investment.moneda,
        cuentaOrigenId: rule.cuentaOrigenId,
        cuentaDestinoId: null,
        categoriaId: null,
        categoriaTexto: null,
        mes,
        anio,
        notas: null,
        esAutomatico: true,
        origenAutomatico: null,
        origenAutomaticoId: rule.id,
      });
      onUndo(() => this.movements.hardDelete(mov.id));

      const contrib = await this.contributions.create({
        id: autoGenId("contrib", rule.id, occKey),
        investmentId,
        fecha,
        participaciones,
        precioUnitario,
        cuentaOrigenId: rule.cuentaOrigenId,
        movimientoId: mov.id,
        notas: APORTACION_PERIODICA_NOTA,
      });
      onUndo(() => this.contributions.hardDelete(contrib.id));

      await this.recomputeWithValue(investmentId, valorAntes + importe);
      return true;
    });
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
      // Deshacer el movimiento asociado: en una aportacion devuelve el importe
      // a su cuenta de origen; en una retirada quita el dinero de la cuenta
      // destino (deshace la retirada).
      await this.movements.softDelete(contribution.movimientoId);

      // Devolver a OTRA cuenta (solo aportaciones): mover el importe de la
      // cuenta de origen a la elegida. En retiradas no aplica.
      if (
        !contribution.esRetirada &&
        refundAccountId &&
        refundAccountId !== contribution.cuentaOrigenId
      ) {
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
    // Borrar una aportacion baja el valor por lo aportado; borrar una retirada
    // lo sube (deshace la retirada).
    const target = contribution.esRetirada
      ? valorAntes + importeQuitado
      : valorAntes - importeQuitado;
    await this.recomputeWithValue(
      contribution.investmentId,
      Math.max(0, target),
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
   * Archiva una inversion (posicion cerrada): la marca como archivada y
   * CANCELA (soft-delete) sus planes de aportacion periodica activos, para que
   * no sigan generando aportaciones. Pensada para usar cuando el valor es 0.
   */
  async archiveInvestment(investmentId: string): Promise<void> {
    const ts = new Date();
    await this.db
      .update(recurringRules)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(
        and(
          eq(recurringRules.origenAutomatico, "investment"),
          eq(recurringRules.origenAutomaticoId, investmentId),
          isNull(recurringRules.deletedAt),
        ),
      );
    await this.investments.archive(investmentId);
  }

  /** Desarchiva una inversion (vuelve a la vista activa). */
  async unarchiveInvestment(investmentId: string): Promise<void> {
    await this.investments.unarchive(investmentId);
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
  /**
   * "Transaccion a nivel de aplicacion" para operaciones multi-paso. Como
   * tauri-plugin-sql usa un POOL de conexiones (no una sola), un BEGIN/COMMIT
   * repartido en varias sentencias NO es fiable; por eso compensamos a mano:
   * cada paso registra su "deshacer" via `onUndo`, y si algo falla luego, se
   * ejecutan los deshacer en orden inverso (best-effort) para no dejar datos a
   * medias (p.ej. un movimiento creado sin su aportacion).
   */
  private async atomic<T>(
    work: (onUndo: (undo: () => Promise<void>) => void) => Promise<T>,
  ): Promise<T> {
    const undos: Array<() => Promise<void>> = [];
    try {
      return await work((undo) => undos.push(undo));
    } catch (err) {
      for (let i = undos.length - 1; i >= 0; i--) {
        try {
          await undos[i]!();
        } catch (e) {
          console.error("[atomic] fallo al compensar (rollback):", e);
        }
      }
      throw err;
    }
  }

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

// ----------------------------------------------------------------------------
//  Helpers de ocurrencias para aportaciones periodicas (Lote 13b-2)
// ----------------------------------------------------------------------------

type Frecuencia = "diaria" | "semanal" | "mensual";

const DAY_MS = 86_400_000;
// Tope de seguridad por regla y pasada, para evitar generar miles de filas si
// fechaInicio es muy antigua (sobre todo en frecuencia diaria).
const OCCURRENCE_CAP = 2000;

/** Numero de dia UTC (medianoche) para comparar a nivel de dia. */
function utcDayNumber(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Fecha a las 12:00 UTC del mismo dia (idempotente si ya lo esta). */
function utcNoon(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0),
  );
}

/**
 * Estrecha la frecuencia (ampliada en 0032 con 'anual'/'varios-mes' para
 * reglas manuales de PC) al conjunto que soportan las aportaciones a
 * inversiones. Estas reglas solo se crean con diaria/semanal/mensual, asi que
 * en la practica es un no-op; el default a 'mensual' es defensivo.
 */
function investmentFrecuencia(f: RecurringRule["frecuencia"]): Frecuencia {
  return f === "diaria" || f === "semanal" ? f : "mensual";
}

/** Clave de idempotencia: por mes (mensual) o por dia (semanal/diaria). */
function occurrenceKey(frecuencia: Frecuencia, fecha: Date): string {
  if (frecuencia === "mensual") {
    return `${fecha.getUTCFullYear()}-${fecha.getUTCMonth() + 1}`;
  }
  return `${fecha.getUTCFullYear()}-${fecha.getUTCMonth() + 1}-${fecha.getUTCDate()}`;
}

/**
 * Fechas (a las 12:00 UTC) en las que toca una aportacion periodica, desde
 * fechaInicio hasta hoy (inclusive), respetando fechaFin.
 *
 *  - mensual: una por mes en diaDelMes (con clamp). Genera el mes en curso
 *    aunque el dia aun no haya llegado (igual que RecurringService).
 *  - semanal: cada 7 dias a partir del primer diaSemana >= fechaInicio.
 *  - diaria: cada dia.
 */
function buildOccurrences(rule: RecurringRule, now: Date): Date[] {
  const start =
    rule.fechaInicio instanceof Date
      ? rule.fechaInicio
      : new Date(rule.fechaInicio);
  const end = rule.fechaFin
    ? rule.fechaFin instanceof Date
      ? rule.fechaFin
      : new Date(rule.fechaFin)
    : null;

  const frecuencia: Frecuencia = investmentFrecuencia(rule.frecuencia);

  if (frecuencia === "mensual") {
    const startAnio = start.getUTCFullYear();
    const startMes = start.getUTCMonth() + 1;
    const { anio: anioEnd, mes: mesEnd } = currentPeriod(now);
    if (
      anioMesToComparableNumber(startAnio, startMes) >
      anioMesToComparableNumber(anioEnd, mesEnd)
    ) {
      return [];
    }
    const result: Date[] = [];
    for (const p of periodsBetween(startAnio, startMes, anioEnd, mesEnd)) {
      if (!isPeriodInRange(p.anio, p.mes, start, end)) continue;
      result.push(buildPeriodDate(rule.diaDelMes, p.anio, p.mes));
    }
    return result;
  }

  // diaria / semanal: iteramos por dias a las 12:00 UTC.
  const stepDays = frecuencia === "semanal" ? 7 : 1;
  let cursor = utcNoon(start);

  if (frecuencia === "semanal") {
    const target = rule.diaSemana ?? cursor.getUTCDay();
    let guard = 0;
    while (cursor.getUTCDay() !== target && guard < 7) {
      cursor = new Date(cursor.getTime() + DAY_MS);
      guard++;
    }
  }

  const nowDay = utcDayNumber(now);
  const endDay = end ? utcDayNumber(end) : Number.POSITIVE_INFINITY;

  const result: Date[] = [];
  let count = 0;
  while (
    utcDayNumber(cursor) <= nowDay &&
    utcDayNumber(cursor) <= endDay &&
    count < OCCURRENCE_CAP
  ) {
    result.push(cursor);
    cursor = new Date(cursor.getTime() + stepDays * DAY_MS);
    count++;
  }
  return result;
}
