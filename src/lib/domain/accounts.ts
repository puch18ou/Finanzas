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
 *  DIVISAS: el importe del movimiento puede estar en una moneda DISTINTA a
 *  la de la cuenta (p.ej. un gasto en EUR desde una cuenta en SGD). En ese
 *  caso se convierte a la moneda de la cuenta usando el RatesMap, para que
 *  el saldo nativo sea correcto. La conversion a moneda vista se hace
 *  despues, en la capa de presentacion.
 * ============================================================================
 */

import { convert, type RatesMap } from "./currency";

type AccountLike = { id: string; saldoInicial: number; moneda: string };

type MovementLike = {
  importe: number;
  moneda: string;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
  deletedAt?: Date | string | null;
};

/**
 * Suma el impacto neto de los movimientos sobre cada cuenta, convirtiendo
 * el importe a la moneda de la cuenta cuando difiere. Ignora movimientos
 * borrados (deletedAt no nulo) y cuentas que no esten en `accounts`.
 *
 * Devuelve un Map cuentaId -> impacto neto (en la moneda de la cuenta).
 */
export function computeNetImpactByAccount(
  accounts: Array<{ id: string; moneda: string }>,
  movements: MovementLike[],
  rates: RatesMap,
): Map<string, number> {
  const monedaById = new Map(accounts.map((a) => [a.id, a.moneda]));
  const impact = new Map<string, number>();

  // Convierte un importe a la moneda de la cuenta destino. Si no hay tipo
  // de cambio disponible, cae al importe crudo (mejor que romper el calculo).
  const toAccountCurrency = (
    importe: number,
    from: string,
    accountId: string,
  ): number => {
    const to = monedaById.get(accountId);
    if (!to || to === from) return importe;
    try {
      return convert(importe, from, to, rates);
    } catch {
      return importe;
    }
  };

  for (const m of movements) {
    if (m.deletedAt) continue;

    if (m.cuentaDestinoId && monedaById.has(m.cuentaDestinoId)) {
      const v = toAccountCurrency(m.importe, m.moneda, m.cuentaDestinoId);
      impact.set(m.cuentaDestinoId, (impact.get(m.cuentaDestinoId) ?? 0) + v);
    }
    if (m.cuentaOrigenId && monedaById.has(m.cuentaOrigenId)) {
      const v = toAccountCurrency(m.importe, m.moneda, m.cuentaOrigenId);
      impact.set(m.cuentaOrigenId, (impact.get(m.cuentaOrigenId) ?? 0) - v);
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
  rates: RatesMap,
): Map<string, number> {
  const impact = computeNetImpactByAccount(accounts, movements, rates);
  const balances = new Map<string, number>();

  for (const a of accounts) {
    balances.set(a.id, a.saldoInicial + (impact.get(a.id) ?? 0));
  }

  return balances;
}
