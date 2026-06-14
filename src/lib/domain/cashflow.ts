/**
 * ============================================================================
 *  src/lib/domain/cashflow.ts — Prevision de liquidez (cash-flow)
 * ============================================================================
 *
 *  Proyecta el saldo LIQUIDO (suma de cuentas) hacia delante aplicando los
 *  movimientos PREVISTOS (recurrentes aun no materializados): ingresos suman,
 *  gastos/cuotas/aportaciones restan. Sirve para responder "como cierro el mes"
 *  y "¿me quedo en numeros rojos en algun momento?".
 *
 *  Funcion pura y testeable: recibe el saldo inicial y los eventos ya
 *  calculados (fecha + delta con signo), no toca BD.
 * ============================================================================
 */

export type CashflowEvent = {
  fecha: Date;
  /** Importe con SIGNO en la moneda objetivo (+ entra, - sale). */
  delta: number;
  label: string;
};

export type CashflowPoint = {
  fecha: Date;
  /** Saldo proyectado DESPUES de aplicar este evento. */
  saldo: number;
  delta: number;
  label: string;
};

export type CashflowProjection = {
  saldoInicial: number;
  puntos: CashflowPoint[];
  /** Saldo al final del horizonte (tras el ultimo evento). */
  saldoFinal: number;
  /** Saldo MINIMO que alcanza en el horizonte (incluye el inicial). */
  minSaldo: number;
  /** Fecha del minimo, o null si el minimo es el saldo inicial (no baja). */
  minFecha: Date | null;
};

/**
 * Proyecta el saldo aplicando los eventos en orden cronologico.
 */
export function projectCashflow(
  saldoInicial: number,
  eventos: CashflowEvent[],
): CashflowProjection {
  const ordenados = [...eventos].sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime(),
  );

  let saldo = saldoInicial;
  let minSaldo = saldoInicial;
  let minFecha: Date | null = null;
  const puntos: CashflowPoint[] = [];

  for (const e of ordenados) {
    saldo += e.delta;
    puntos.push({ fecha: e.fecha, saldo, delta: e.delta, label: e.label });
    if (saldo < minSaldo) {
      minSaldo = saldo;
      minFecha = e.fecha;
    }
  }

  return { saldoInicial, puntos, saldoFinal: saldo, minSaldo, minFecha };
}

/**
 * Saldo proyectado a una fecha dada (incluida): saldo inicial + todos los
 * deltas con fecha <= limite. Util para "saldo previsto a fin de mes".
 */
export function saldoAtDate(
  saldoInicial: number,
  eventos: CashflowEvent[],
  limite: Date,
): number {
  let saldo = saldoInicial;
  const t = limite.getTime();
  for (const e of eventos) {
    if (e.fecha.getTime() <= t) saldo += e.delta;
  }
  return saldo;
}
