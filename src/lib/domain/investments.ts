/**
 * ============================================================================
 *  src/lib/domain/investments.ts — Calculos de inversiones
 * ============================================================================
 *
 *  Funciones puras para calcular P/L (profit/loss), valores y resumenes
 *  de la cartera de inversion.
 *
 *  MODELO MENTAL
 *  -------------
 *  Cada Investment guarda:
 *    - participaciones (cuantas unidades tienes)
 *    - precioCompra (precio al que la compraste)
 *    - precioActual (precio actual de la unidad)
 *    - moneda (en la que cotiza el activo)
 *
 *  De ahi derivamos:
 *    - valorActual    = participaciones * precioActual
 *    - costeTotal     = participaciones * precioCompra
 *    - plAbsoluto     = valorActual - costeTotal
 *    - plPorcentaje   = (valorActual / costeTotal) - 1
 *
 *  Todo en moneda nativa. La conversion a moneda vista la hace el caller
 *  usando convert() del modulo currency.
 * ============================================================================
 */

import type { Investment } from "@/lib/db/schema";
import { convert, type RatesMap } from "./currency";

/**
 * Recalcula los totales cacheados de una inversion a partir de sus
 * aportaciones (Lote 13): total de participaciones y coste medio PONDERADO.
 *
 *   participaciones = Σ part_i
 *   precioMedio     = Σ(part_i · precio_i) / Σ part_i   (0 si no hay)
 *
 * Estos valores se guardan en investments.participaciones / precioCompra para
 * que el resto de la app (metricas, dashboard, proyeccion) siga funcionando.
 */
export type ContributionLike = {
  participaciones: number;
  precioUnitario: number;
};

export function recomputeTotalsFromContributions(
  contributions: ContributionLike[],
): { participaciones: number; precioMedio: number } {
  let totalParticipaciones = 0;
  let costeTotal = 0;
  for (const c of contributions) {
    totalParticipaciones += c.participaciones;
    costeTotal += c.participaciones * c.precioUnitario;
  }
  const precioMedio =
    totalParticipaciones > 0 ? costeTotal / totalParticipaciones : 0;
  return { participaciones: totalParticipaciones, precioMedio };
}

export type InvestmentMetrics = {
  valorActual: number;
  costeTotal: number;
  plAbsoluto: number;
  plPorcentaje: number;
};

/**
 * Calcula las metricas derivadas de una inversion en su moneda nativa.
 */
export function calculateInvestmentMetrics(inv: Investment): InvestmentMetrics {
  const valorActual = inv.participaciones * inv.precioActual;
  const costeTotal = inv.participaciones * inv.precioCompra;
  const plAbsoluto = valorActual - costeTotal;
  const plPorcentaje = costeTotal > 0 ? valorActual / costeTotal - 1 : 0;

  return {
    valorActual,
    costeTotal,
    plAbsoluto,
    plPorcentaje,
  };
}

/**
 * Resumen de la cartera completa en moneda vista.
 */
export type PortfolioSummary = {
  valorActualVista: number;
  costeTotalVista: number;
  plAbsolutoVista: number;
  plPorcentaje: number;
  numPosiciones: number;
};

export function summarizePortfolio(
  investments: Investment[],
  rates: RatesMap,
  viewCurrency: string,
): PortfolioSummary {
  let valorActualVista = 0;
  let costeTotalVista = 0;

  for (const inv of investments) {
    const m = calculateInvestmentMetrics(inv);
    try {
      valorActualVista += convert(m.valorActual, inv.moneda, viewCurrency, rates);
      costeTotalVista += convert(m.costeTotal, inv.moneda, viewCurrency, rates);
    } catch {
      // Moneda no encontrada; ignoramos esta posicion
    }
  }

  const plAbsolutoVista = valorActualVista - costeTotalVista;
  const plPorcentaje =
    costeTotalVista > 0 ? valorActualVista / costeTotalVista - 1 : 0;

  return {
    valorActualVista,
    costeTotalVista,
    plAbsolutoVista,
    plPorcentaje,
    numPosiciones: investments.length,
  };
}

/**
 * Agrupacion por tipo (Acciones, ETF, Fondo, Cripto...).
 */
export function valuesByType(
  investments: Investment[],
  rates: RatesMap,
  viewCurrency: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const inv of investments) {
    const m = calculateInvestmentMetrics(inv);
    try {
      const v = convert(m.valorActual, inv.moneda, viewCurrency, rates);
      result[inv.tipo] = (result[inv.tipo] ?? 0) + v;
    } catch {
      // ignorar
    }
  }
  return result;
}
