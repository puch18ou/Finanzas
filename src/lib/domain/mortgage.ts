/**
 * ============================================================================
 *  src/lib/domain/mortgage.ts — Calculos de hipoteca
 * ============================================================================
 *
 *  Funciones puras para:
 *    - Cuota mensual (PMT, igual que la formula de Excel)
 *    - Tabla de amortizacion completa mes a mes
 *    - Total de intereses pagados
 *    - Comparativa de plazos (e.g. "si en lugar de 30 anios fueran 25...")
 *
 *  La hipoteca solo es UN caso particular de prestamo amortizable; las
 *  mismas funciones se reutilizan en otherDebts.
 *
 *  FORMULA PMT
 *  -----------
 *  La cuota mensual fija de un prestamo a interes compuesto es:
 *
 *      cuota = P * (r * (1+r)^n) / ((1+r)^n - 1)
 *
 *    donde:
 *      P = capital prestado (principal)
 *      r = tipo de interes MENSUAL (TIN anual / 12)
 *      n = numero TOTAL de cuotas (anios * 12)
 *
 *  Si r = 0 (caso degenerado, prestamo sin interes), cuota = P / n.
 *
 *  TIPOS DE HIPOTECA
 *  -----------------
 *  Fija:     TIN constante toda la vida del prestamo.
 *  Variable: TIN = tipo de referencia (euribor) + diferencial.
 *            La cuota se recalcula al revisarse el indice (anualmente
 *            normalmente). En el simulador asumimos un TIN constante igual
 *            al valor actual.
 *  Mixta:    TIN fijo durante `aniosTipoFijo`, luego pasa a variable.
 *            En el simulador asumimos TIN constante igual al fijo durante
 *            todo el plazo (es una aproximacion conservadora).
 *
 *  Estas simplificaciones se pueden refinar mas adelante; por ahora son
 *  suficientes para tener simulaciones utiles.
 * ============================================================================
 */

import type { Mortgage } from "@/lib/db/schema";

/**
 * Calcula la cuota mensual de un prestamo a interes compuesto.
 *
 * @param principal     capital prestado
 * @param annualRate    TIN anual como decimal (0.032 = 3.2%)
 * @param years         plazo en anios
 * @returns cuota mensual
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number,
): number {
  const totalPayments = years * 12;

  if (totalPayments <= 0) return 0;
  if (principal <= 0) return 0;

  const monthlyRate = annualRate / 12;

  // Caso degenerado: interes cero.
  if (monthlyRate === 0) {
    return principal / totalPayments;
  }

  const factor = Math.pow(1 + monthlyRate, totalPayments);
  return (principal * monthlyRate * factor) / (factor - 1);
}

/**
 * Una fila de la tabla de amortizacion.
 */
export type AmortizationRow = {
  /** numero de cuota, comenzando en 1 */
  mes: number;
  /** capital pendiente al INICIO del mes (antes de pagar la cuota) */
  capitalInicio: number;
  /** cuota total del mes (igual para todos los meses con TIN fijo) */
  cuota: number;
  /** parte de la cuota que va a intereses */
  intereses: number;
  /** parte de la cuota que va a amortizar capital */
  amortizacion: number;
  /** capital pendiente al FINAL del mes */
  capitalFinal: number;
  /** porcentaje del prestamo amortizado acumulado al final del mes */
  pctAmortizado: number;
};

/**
 * Genera la tabla de amortizacion completa de un prestamo.
 * Devuelve un array con una fila por mes (years * 12 filas).
 */
export function buildAmortizationTable(
  principal: number,
  annualRate: number,
  years: number,
): AmortizationRow[] {
  const totalPayments = years * 12;
  if (totalPayments <= 0 || principal <= 0) return [];

  const monthlyRate = annualRate / 12;
  const cuota = calculateMonthlyPayment(principal, annualRate, years);

  const rows: AmortizationRow[] = [];
  let capital = principal;

  for (let mes = 1; mes <= totalPayments; mes++) {
    const capitalInicio = capital;
    const intereses = capitalInicio * monthlyRate;
    let amortizacion = cuota - intereses;

    // En el ultimo mes puede haber pequenas desviaciones por redondeo;
    // ajustamos la amortizacion para que capital quede exactamente en 0.
    if (mes === totalPayments) {
      amortizacion = capitalInicio;
    }

    const capitalFinal = capitalInicio - amortizacion;
    const pctAmortizado = (principal - capitalFinal) / principal;

    rows.push({
      mes,
      capitalInicio,
      cuota: intereses + amortizacion,
      intereses,
      amortizacion,
      capitalFinal,
      pctAmortizado,
    });

    capital = capitalFinal;
  }

  return rows;
}

/**
 * Resumen rapido de una hipoteca: capital, cuota, intereses totales,
 * total pagado. Util para mostrar arriba de la pagina de Hipoteca y
 * en el Dashboard.
 */
export type MortgageSummary = {
  capitalPrestado: number;
  cuotaMensual: number;
  numeroCuotas: number;
  totalAPagar: number;
  totalIntereses: number;
};

/**
 * Calcula el resumen sin generar toda la tabla de amortizacion. Mas barato.
 *
 * El capital prestado = precio - entrada + gastos asociados. Esto refleja
 * que los gastos (notaria, ITP, registro) generalmente se financian.
 */
export function summarizeMortgage(m: {
  precioVivienda: number;
  entrada: number;
  gastosAsociados: number;
  plazoAnios: number;
  tin: number;
}): MortgageSummary {
  const capitalPrestado = m.precioVivienda - m.entrada + m.gastosAsociados;
  const cuotaMensual = calculateMonthlyPayment(
    capitalPrestado,
    m.tin,
    m.plazoAnios,
  );
  const numeroCuotas = m.plazoAnios * 12;
  const totalAPagar = cuotaMensual * numeroCuotas;
  const totalIntereses = totalAPagar - capitalPrestado;

  return {
    capitalPrestado,
    cuotaMensual,
    numeroCuotas,
    totalAPagar,
    totalIntereses,
  };
}

/**
 * Resume una hipoteca completa de la BD (con tipo + diferencial + etc).
 * Aplica las simplificaciones documentadas en el bloque inicial:
 *   - Variable: usa diferencial + tipoReferencia
 *   - Mixta: usa el TIN fijo
 */
export function summarizeMortgageRow(row: Mortgage): MortgageSummary {
  let effectiveTin = row.tin;
  if (row.tipo === "Variable") {
    effectiveTin = row.tipoReferencia + row.diferencial;
  }
  // Mixta: usamos `row.tin` que representa el TIN del periodo fijo.

  return summarizeMortgage({
    precioVivienda: row.precioVivienda,
    entrada: row.entrada,
    gastosAsociados: row.gastosAsociados,
    plazoAnios: row.plazoAnios,
    tin: effectiveTin,
  });
}
