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
 * Tipos de inversion que se llevan POR PARTICIPACIONES (numero de unidades a un
 * precio). El resto (Fondo, Bono, Plan pensiones, Inmueble, Robo-advisor,
 * Cuenta remunerada, Otro) se llevan en modo "solo dinero": el usuario solo
 * mete importes y el valor actual total, sin participaciones.
 *
 * En modo dinero, internamente guardamos participaciones = importe (euros) y
 * precio por unidad = 1, de modo que toda la logica de coste/valor sigue igual.
 */
const TIPOS_CON_PARTICIPACIONES = new Set(["Acciones", "ETF", "Cripto"]);

export function usaParticipaciones(tipo: string): boolean {
  return TIPOS_CON_PARTICIPACIONES.has(tipo);
}

/**
 * Marca en `notas` que identifica una aportacion generada por un plan periodico
 * (Lote 13b-2). Se usa para separar en la UI las aportaciones individuales de
 * las periodicas.
 */
export const APORTACION_PERIODICA_NOTA = "Aportacion periodica";

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
  /** Comision de la operacion (Lote 17). Sube el coste medio en aportaciones; reduce el "ingreso" en retiradas. */
  comision?: number;
  /** true = retirada: resta en lugar de sumar. */
  esRetirada?: boolean;
};

export function recomputeTotalsFromContributions(
  contributions: ContributionLike[],
): { participaciones: number; precioMedio: number } {
  let totalParticipaciones = 0;
  let costeTotal = 0;
  for (const c of contributions) {
    const signo = c.esRetirada ? -1 : 1;
    const comision = c.comision ?? 0;
    totalParticipaciones += signo * c.participaciones;
    // En aportaciones, la comision SUMA al coste (sube el coste medio).
    // En retiradas, la comision REDUCE lo recuperado, por lo que el coste
    // que sale de la cartera es (participaciones*precio - comision).
    const costeOperacion = c.esRetirada
      ? c.participaciones * c.precioUnitario - comision
      : c.participaciones * c.precioUnitario + comision;
    costeTotal += signo * costeOperacion;
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

// ============================================================================
//  Lote 16 — TAE automatica para "Cuenta remunerada"
// ============================================================================

export type FrecuenciaInteres = "mensual" | "trimestral" | "anual";

/**
 * Periodos COMPLETOS transcurridos entre dos fechas segun la frecuencia.
 * Cuenta por dia del mes: si la fecha "desde" es el 25 y "hasta" es el 24
 * del mes siguiente, NO ha pasado todavia un periodo mensual.
 *
 * Devuelve 0 si hasta <= desde.
 */
export function periodosTranscurridos(
  desde: Date,
  hasta: Date,
  frecuencia: FrecuenciaInteres,
): number {
  if (hasta.getTime() <= desde.getTime()) return 0;
  let months =
    (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 +
    (hasta.getUTCMonth() - desde.getUTCMonth());
  if (hasta.getUTCDate() < desde.getUTCDate()) months--;
  if (months < 0) return 0;
  switch (frecuencia) {
    case "mensual":
      return months;
    case "trimestral":
      return Math.floor(months / 3);
    case "anual":
      return Math.floor(months / 12);
  }
}

/**
 * Periodos por anio segun la frecuencia.
 */
export function periodosPorAnio(frecuencia: FrecuenciaInteres): number {
  switch (frecuencia) {
    case "mensual":
      return 12;
    case "trimestral":
      return 4;
    case "anual":
      return 1;
  }
}

/**
 * Calcula el nuevo precioActual tras aplicar N periodos de interes.
 *
 *   - compuesto: precioActual *= (1 + r/n)^periodos
 *   - simple:    precioActual += precioCompra * (r/n) * periodos
 *
 * Donde r = tasa anual en tanto por uno (3% → 0.03), n = periodos por anio.
 *
 * En modo "solo dinero" (participaciones = importe, precioCompra = 1) ambas
 * formulas son equivalentes a interpretar precioActual como un "factor" sobre
 * el principal: en simple el factor crece linealmente con tasa/n por periodo;
 * en compuesto crece geometricamente.
 */
export function aplicarIntereses(
  precioActualPrev: number,
  precioCompra: number,
  tasaAnualPct: number,
  frecuencia: FrecuenciaInteres,
  compuesto: boolean,
  periodos: number,
): number {
  if (periodos <= 0) return precioActualPrev;
  const n = periodosPorAnio(frecuencia);
  const r = tasaAnualPct / 100;
  if (compuesto) {
    return precioActualPrev * Math.pow(1 + r / n, periodos);
  }
  return precioActualPrev + precioCompra * (r / n) * periodos;
}

/**
 * Avanza una fecha "ultimo aplicado" en N periodos segun la frecuencia.
 * Util para actualizar `ultimoInteresAplicado` tras aplicar intereses.
 */
export function avanzarFechaPeriodos(
  desde: Date,
  periodos: number,
  frecuencia: FrecuenciaInteres,
): Date {
  if (periodos <= 0) return desde;
  const mesesPorPeriodo =
    frecuencia === "mensual" ? 1 : frecuencia === "trimestral" ? 3 : 12;
  const totalMeses = periodos * mesesPorPeriodo;
  const d = new Date(desde.getTime());
  d.setUTCMonth(d.getUTCMonth() + totalMeses);
  return d;
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
