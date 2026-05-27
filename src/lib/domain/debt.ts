/**
 * src/lib/domain/debt.ts
 *
 * Calculo de cuota mensual para "otras deudas" (prestamos personales,
 * coche, etc.). Misma formula que hipoteca (sistema frances).
 *
 * cuota = capital * (i / (1 - (1+i)^-n))
 *
 *   i = tin / 12     (tipo mensual)
 *   n = plazoRestanteMeses
 */

export function calculateDebtMonthlyPayment(
  capitalPendiente: number,
  tin: number,
  plazoRestanteMeses: number,
): number {
  if (capitalPendiente <= 0 || plazoRestanteMeses <= 0) return 0;
  if (tin <= 0) {
    // Sin intereses: cuota lineal
    return capitalPendiente / plazoRestanteMeses;
  }
  const i = tin / 12;
  const numerator = capitalPendiente * i;
  const denominator = 1 - Math.pow(1 + i, -plazoRestanteMeses);
  return numerator / denominator;
}
