/**
 * ============================================================================
 *  src/lib/services/investment-interest-service.ts
 * ============================================================================
 *
 *  Aplica los intereses pendientes a las inversiones con TAE configurada
 *  (Lote 16). Solo sube `precioActual`; no genera movimientos.
 *
 *  Periodicidad por inversion (mensual/trimestral/anual) y modo
 *  (compuesto/simple). Idempotente: usa `ultimoInteresAplicado` como
 *  marca de la ultima fecha aplicada y solo aplica periodos enteros
 *  transcurridos desde entonces.
 * ============================================================================
 */

import { and, eq, isNull, isNotNull } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { investments } from "@/lib/db/schema";
import type { Investment } from "@/lib/db/schema";
import {
  aplicarIntereses,
  avanzarFechaPeriodos,
  periodosTranscurridos,
  type FrecuenciaInteres,
} from "@/lib/domain/investments";

export type InterestApplicationResult = {
  /** Numero de inversiones a las que se aplico al menos 1 periodo. */
  inversionesActualizadas: number;
  /** Total de periodos aplicados sumando todas las inversiones. */
  periodosAplicados: number;
};

const FRECUENCIAS_VALIDAS: ReadonlySet<string> = new Set([
  "mensual",
  "trimestral",
  "anual",
]);

export class InvestmentInterestService {
  constructor(private db: DrizzleDb) {}

  /**
   * Aplica los intereses pendientes a todas las inversiones activas (no
   * borradas, no archivadas) con TAE > 0 y frecuencia/modo configurados.
   */
  async applyPendingInterest(
    now: Date = new Date(),
  ): Promise<InterestApplicationResult> {
    const rows: Investment[] = await this.db
      .select()
      .from(investments)
      .where(
        and(
          isNull(investments.deletedAt),
          eq(investments.archivada, false),
          isNotNull(investments.tasaInteres),
        ),
      );

    let inversionesActualizadas = 0;
    let periodosAplicados = 0;
    const nowMs = now.getTime();

    for (const inv of rows) {
      const tasa = inv.tasaInteres;
      const frecuencia = inv.frecuenciaInteres as FrecuenciaInteres | null;
      const compuesto = inv.interesCompuesto;
      if (tasa == null || tasa <= 0) continue;
      if (!frecuencia || !FRECUENCIAS_VALIDAS.has(frecuencia)) continue;
      if (compuesto == null) continue;

      // Base de referencia: ultimo interes aplicado, o si no, fecha de
      // compra, o si no, createdAt.
      const desde =
        inv.ultimoInteresAplicado ??
        inv.fechaCompra ??
        inv.createdAt;
      const desdeDate = desde instanceof Date ? desde : new Date(desde);

      const periodos = periodosTranscurridos(desdeDate, now, frecuencia);
      if (periodos <= 0) continue;

      const precioActualNuevo = aplicarIntereses(
        inv.precioActual,
        inv.precioCompra,
        tasa,
        frecuencia,
        compuesto,
        periodos,
      );

      const nuevaFecha = avanzarFechaPeriodos(desdeDate, periodos, frecuencia);
      const stampMs = Math.min(nuevaFecha.getTime(), nowMs);

      await this.db
        .update(investments)
        .set({
          precioActual: precioActualNuevo,
          ultimoInteresAplicado: new Date(stampMs),
          updatedAt: new Date(nowMs),
        })
        .where(eq(investments.id, inv.id));

      inversionesActualizadas++;
      periodosAplicados += periodos;
    }

    return { inversionesActualizadas, periodosAplicados };
  }
}
