/**
 * ============================================================================
 *  src/lib/domain/networth.ts — Patrimonio neto (calculo puro)
 * ============================================================================
 *
 *  Reune en un solo sitio la formula del patrimonio neto que usa el dashboard:
 *
 *    patrimonioNeto = valorCuentas + valorInversiones - deudaTotal
 *
 *  Todo convertido a UNA moneda objetivo. Para el dashboard se usa la moneda
 *  VISTA; para los snapshots historicos usamos la moneda LOCAL (base estable,
 *  asi la curva es comparable aunque cambies la moneda de visualizacion).
 *
 *  Funcion pura y testeable: recibe los datos ya cargados, no toca BD.
 * ============================================================================
 */

import { convert, type RatesMap } from "./currency";
import { summarizePortfolio } from "./investments";
import { summarizeMortgage } from "./mortgage";
import type { Account, Investment, Mortgage, OtherDebt } from "../db/schema";

export type NetWorthBreakdown = {
  /** Suma de saldos de cuentas activas, en la moneda objetivo. */
  valorCuentas: number;
  /** Valor actual de la cartera de inversiones, en la moneda objetivo. */
  valorInversiones: number;
  /** Deuda total (capital de hipoteca + otras deudas), en la moneda objetivo. */
  deudaTotal: number;
  /** valorCuentas + valorInversiones - deudaTotal. */
  patrimonioNeto: number;
};

export function computeNetWorth(args: {
  accounts: Account[];
  /** Saldo calculado por cuenta (id -> saldo en la moneda de la cuenta). */
  balances: Map<string, number>;
  investments: Investment[];
  mortgage: Mortgage | null;
  debts: OtherDebt[];
  rates: RatesMap;
  /** Moneda objetivo a la que se convierte todo (vista o local). */
  currency: string;
}): NetWorthBreakdown {
  const { accounts, balances, investments, mortgage, debts, rates, currency } =
    args;

  let valorCuentas = 0;
  for (const a of accounts) {
    if (!a.activa) continue;
    try {
      valorCuentas += convert(
        balances.get(a.id) ?? 0,
        a.moneda,
        currency,
        rates,
      );
    } catch {
      // moneda sin tipo de cambio: la ignoramos en el total
    }
  }

  const valorInversiones = summarizePortfolio(
    investments,
    rates,
    currency,
  ).valorActualVista;

  let deudaTotal = 0;
  if (mortgage && mortgage.activa) {
    const ms = summarizeMortgage({
      precioVivienda: mortgage.precioVivienda,
      entrada: mortgage.entrada,
      gastosAsociados: mortgage.gastosAsociados,
      plazoAnios: mortgage.plazoAnios,
      tin: mortgage.tin,
    });
    try {
      deudaTotal += convert(ms.capitalPrestado, mortgage.moneda, currency, rates);
    } catch {
      // ignorar si no hay tipo de cambio
    }
  }
  for (const d of debts) {
    try {
      deudaTotal += convert(d.capitalPendiente, d.moneda, currency, rates);
    } catch {
      // ignorar
    }
  }

  const patrimonioNeto = valorCuentas + valorInversiones - deudaTotal;
  return { valorCuentas, valorInversiones, deudaTotal, patrimonioNeto };
}
