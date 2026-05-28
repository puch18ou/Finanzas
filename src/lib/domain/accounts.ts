/**
 * ============================================================================
 *  src/lib/domain/accounts.ts — saldo calculado de cuentas (Lote 10b)
 * ============================================================================
 *
 *  El saldo de una cuenta NO se guarda. Se calcula como:
 *
 *      saldo = saldoInicial + impactoNeto(movimientos)
 *
 *  donde el impacto neto suma +importe cuando la cuenta es DESTINO del
 *  movimiento y -importe cuando es ORIGEN. Esto vale para todos los tipos
 *  (gasto/ingreso/transferencia/ajuste/intereses/cuota): el signo lo
 *  determina unicamente que campo de cuenta esta relleno.
 *
 *  IMPORTANTE: se asume que el importe del movimiento esta en la MISMA
 *  moneda que la cuenta. La app no convierte aqui (el saldo nativo se
 *  mantiene en la moneda de la cuenta; la conversion a moneda vista se hace
 *  despues, en la capa de presentacion). Esto replica el comportamiento de
 *  MovementRepository.impactoNetoCuenta.
 * ============================================================================
 */

type AccountLike = { id: string; saldoInicial: number };

type MovementLike = {
  importe: number;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
  deletedAt?: Date | string | null;
};

/**
 * Suma el impacto neto de los movimientos sobre cada cuenta.
 * Ignora movimientos borrados (deletedAt no nulo).
 *
 * Devuelve un Map cuentaId -> impacto neto (en la moneda de la cuenta).
 */
export function computeNetImpactByAccount(
  movements: MovementLike[],
): Map<string, number> {
  const impact = new Map<string, number>();

  for (const m of movements) {
    if (m.deletedAt) continue;

    if (m.cuentaDestinoId) {
      impact.set(
        m.cuentaDestinoId,
        (impact.get(m.cuentaDestinoId) ?? 0) + m.importe,
      );
    }
    if (m.cuentaOrigenId) {
      impact.set(
        m.cuentaOrigenId,
        (impact.get(m.cuentaOrigenId) ?? 0) - m.importe,
      );
    }
  }

  return impact;
}

/**
 * Calcula el saldo actual de cada cuenta: saldoInicial + impacto neto.
 * Devuelve un Map cuentaId -> saldo (en la moneda nativa de la cuenta).
 */
export function computeAccountBalances(
  accounts: AccountLike[],
  movements: MovementLike[],
): Map<string, number> {
  const impact = computeNetImpactByAccount(movements);
  const balances = new Map<string, number>();

  for (const a of accounts) {
    balances.set(a.id, a.saldoInicial + (impact.get(a.id) ?? 0));
  }

  return balances;
}
