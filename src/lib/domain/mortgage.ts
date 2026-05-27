/**
 * ============================================================================
 *  src/lib/domain/mortgage.ts — Calculos de hipoteca / amortizacion
 * ============================================================================
 *
 *  Funciones puras para hipotecas y otras deudas tipo prestamo frances.
 *
 *  API publica (estable, compatible con tests existentes):
 *    - calculateMonthlyPayment(p, tin, anios)
 *    - buildAmortizationTable(p, tin, anios) → AmortizationRow[]
 *      Cada fila lleva: mes, cuota, intereses, amortizacion,
 *      capitalInicio, capitalFinal, pctAmortizado
 *    - summarizeMortgage({precioVivienda, entrada, gastosAsociados, plazoAnios, tin})
 *
 *  AÑADIDO EN LOTE 8:
 *    - buildAnnualSummary(rows) → agrupa la tabla por años para mostrar
 *      25 filas en lugar de 300, con expansion mes a mes.
 *    - summarizeLoan(principal, tin, meses) → para "Otras deudas" donde
 *      se da el capital ya prestado y el plazo en meses, sin pasar por
 *      precioVivienda/entrada.
 *
 *  CONCEPTOS
 *  ---------
 *  - Cuota fija (sistema frances): cada mes pagas el mismo importe, pero
 *    la proporcion capital/intereses va cambiando.
 *
 *  - Formula PMT:
 *      cuota = P * r / (1 - (1+r)^-n)
 *      donde:
 *        P = capital prestado
 *        r = tipo de interes mensual (TIN_anual / 12)
 *        n = numero total de cuotas
 *
 *  IMPORTANTE: el parametro `aniosOMeses` de las funciones del prestamo
 *  hipotecario se interpreta como AÑOS (multiplica por 12 internamente).
 *  La nueva funcion summarizeLoan() acepta MESES directamente para
 *  prestamos personales/coche.
 * ============================================================================
 */

/**
 * Calcula la cuota mensual de un prestamo frances.
 *
 *   - principal: capital prestado
 *   - tinAnual: tipo de interes nominal anual (0.032 = 3.2%)
 *   - anios: plazo en ANIOS (no meses)
 *
 * Si tinAnual es 0, devuelve principal/(anios*12).
 * Si principal o anios es 0, devuelve 0.
 */
export function calculateMonthlyPayment(
  principal: number,
  tinAnual: number,
  anios: number,
): number {
  if (principal <= 0 || anios <= 0) return 0;
  const meses = anios * 12;
  if (tinAnual === 0) return principal / meses;
  const r = tinAnual / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -meses));
}

/**
 * Una fila de la tabla de amortizacion (mes a mes).
 *
 * Campos (estables, los tests dependen de estos nombres):
 *   - mes: numero de cuota (1, 2, 3...)
 *   - cuota: importe total del mes
 *   - intereses: parte que va a intereses
 *   - amortizacion: parte que va a capital
 *   - capitalInicio: capital pendiente ANTES de pagar la cuota
 *   - capitalFinal: capital pendiente DESPUES de pagar la cuota
 *   - pctAmortizado: porcentaje del principal ya amortizado (0..1)
 */
export type AmortizationRow = {
  mes: number;
  cuota: number;
  intereses: number;
  amortizacion: number;
  capitalInicio: number;
  capitalFinal: number;
  pctAmortizado: number;
};

/**
 * Construye la tabla de amortizacion completa.
 *
 *   - principal: capital prestado
 *   - tinAnual: tipo de interes anual decimal
 *   - anios: plazo en ANIOS
 */
export function buildAmortizationTable(
  principal: number,
  tinAnual: number,
  anios: number,
): AmortizationRow[] {
  if (principal <= 0 || anios <= 0) return [];

  const meses = anios * 12;
  const cuota = calculateMonthlyPayment(principal, tinAnual, anios);
  const r = tinAnual / 12;

  const rows: AmortizationRow[] = [];
  let capitalInicio = principal;

  for (let mes = 1; mes <= meses; mes++) {
    const intereses = capitalInicio * r;
    let amortizacion = cuota - intereses;

    // Ajuste de redondeo en la ultima cuota: la amortizacion absorbe
    // cualquier residuo para que capitalFinal acabe exactamente en 0.
    if (mes === meses) {
      amortizacion = capitalInicio;
    }

    const capitalFinal = Math.max(0, capitalInicio - amortizacion);
    const pctAmortizado = 1 - capitalFinal / principal;

    rows.push({
      mes,
      cuota: amortizacion + intereses,
      intereses,
      amortizacion,
      capitalInicio,
      capitalFinal,
      pctAmortizado,
    });

    capitalInicio = capitalFinal;
  }

  return rows;
}

// ============================================================================
//  summarizeMortgage — resumen de una hipoteca completa
// ============================================================================

/**
 * Input para summarizeMortgage. Refleja los campos que el usuario
 * realmente introduce: precio, entrada, gastos.
 */
export type MortgageInput = {
  precioVivienda: number;
  entrada: number;
  gastosAsociados: number;
  plazoAnios: number;
  tin: number;
};

/**
 * Resumen calculado de una hipoteca.
 */
export type MortgageSummary = {
  capitalPrestado: number;
  cuotaMensual: number;
  numeroCuotas: number;
  totalAPagar: number;
  totalIntereses: number;
};

/**
 * Calcula el resumen de una hipoteca a partir de sus parametros.
 *
 * capitalPrestado = precioVivienda - entrada + gastosAsociados
 *   (los gastos asociados se financian junto con la hipoteca; si no se
 *    financian, el usuario los pondria a 0 aqui y a parte como entrada)
 */
export function summarizeMortgage(input: MortgageInput): MortgageSummary {
  const capitalPrestado =
    input.precioVivienda - input.entrada + input.gastosAsociados;

  const cuotaMensual = calculateMonthlyPayment(
    capitalPrestado,
    input.tin,
    input.plazoAnios,
  );

  const numeroCuotas = input.plazoAnios * 12;
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

// ============================================================================
//  summarizeLoan — variante para prestamos en meses
// ============================================================================

export type LoanSummary = {
  cuotaMensual: number;
  totalAPagar: number;
  totalIntereses: number;
  numCuotas: number;
};

/**
 * Resumen para un prestamo donde ya conoces el capital prestado y el
 * plazo en meses. Util para "Otras deudas".
 */
export function summarizeLoan(
  principal: number,
  tinAnual: number,
  meses: number,
): LoanSummary {
  if (principal <= 0 || meses <= 0) {
    return { cuotaMensual: 0, totalAPagar: 0, totalIntereses: 0, numCuotas: 0 };
  }
  const anios = meses / 12;
  const cuota = calculateMonthlyPayment(principal, tinAnual, anios);
  const totalAPagar = cuota * meses;
  return {
    cuotaMensual: cuota,
    totalAPagar,
    totalIntereses: totalAPagar - principal,
    numCuotas: meses,
  };
}

// ============================================================================
//  buildAnnualSummary — agrupacion anual de la tabla de amortizacion
// ============================================================================

/**
 * Una fila del resumen anual.
 */
export type AnnualSummaryRow = {
  /** Numero de año (1, 2, 3...) */
  anio: number;
  /** Suma de cuotas pagadas en el año */
  cuotaAnual: number;
  /** Suma de intereses del año */
  interesesAnio: number;
  /** Suma de capital amortizado en el año */
  capitalAnio: number;
  /** Capital pendiente a final de año (capitalFinal del ultimo mes) */
  capitalPendiente: number;
  /** Capital amortizado acumulado a final de año */
  capitalAmortizado: number;
  /** Las filas mensuales que componen este año */
  meses: AmortizationRow[];
};

/**
 * Agrupa una tabla de amortizacion mensual en filas anuales.
 */
export function buildAnnualSummary(
  rows: AmortizationRow[],
): AnnualSummaryRow[] {
  if (rows.length === 0) return [];

  const result: AnnualSummaryRow[] = [];
  const totalMeses = rows.length;
  const totalAnios = Math.ceil(totalMeses / 12);
  const principal = rows[0]!.capitalInicio;

  for (let anio = 1; anio <= totalAnios; anio++) {
    const startIdx = (anio - 1) * 12;
    const endIdx = Math.min(anio * 12, totalMeses);
    const meses = rows.slice(startIdx, endIdx);
    if (meses.length === 0) continue;

    const cuotaAnual = meses.reduce((s, r) => s + r.cuota, 0);
    const interesesAnio = meses.reduce((s, r) => s + r.intereses, 0);
    const capitalAnio = meses.reduce((s, r) => s + r.amortizacion, 0);
    const last = meses[meses.length - 1]!;
    const capitalAmortizado = principal - last.capitalFinal;

    result.push({
      anio,
      cuotaAnual,
      interesesAnio,
      capitalAnio,
      capitalPendiente: last.capitalFinal,
      capitalAmortizado,
      meses,
    });
  }

  return result;
}
