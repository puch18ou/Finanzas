/**
 * tests/domain/networth.test.ts
 *
 * Patrimonio neto = valorCuentas + valorInversiones - deudaTotal, todo en una
 * moneda objetivo. Probamos cuentas multi-moneda, exclusion de inactivas,
 * hipoteca (capital prestado) y otras deudas. La cartera va vacia: su valor lo
 * cubre summarizePortfolio en sus propios tests.
 */

import { describe, it, expect } from "vitest";
import { computeNetWorth } from "@/lib/domain/networth";
import type { Account, Mortgage, OtherDebt } from "@/lib/db/schema";

// Tipos de cambio relativos a la moneda objetivo (EUR): 1 USD = 0.9 EUR.
const rates = { EUR: 1, USD: 0.9 };

function cuenta(id: string, moneda: string, activa: boolean): Account {
  return { id, moneda, activa } as unknown as Account;
}

function deuda(capitalPendiente: number, moneda: string): OtherDebt {
  return { capitalPendiente, moneda } as unknown as OtherDebt;
}

const hipotecaActiva: Mortgage = {
  activa: true,
  moneda: "EUR",
  precioVivienda: 200_000,
  entrada: 40_000,
  gastosAsociados: 20_000, // capitalPrestado = 200k - 40k + 20k = 180k
  plazoAnios: 30,
  tin: 0.03,
} as unknown as Mortgage;

describe("computeNetWorth", () => {
  it("suma cuentas activas convirtiendo a la moneda objetivo", () => {
    const accounts = [
      cuenta("a", "EUR", true),
      cuenta("b", "USD", true),
      cuenta("c", "EUR", false), // inactiva: se ignora
    ];
    const balances = new Map([
      ["a", 10_000],
      ["b", 1_000], // 1000 USD * 0.9 = 900 EUR
      ["c", 99_999],
    ]);

    const r = computeNetWorth({
      accounts,
      balances,
      investments: [],
      mortgage: null,
      debts: [],
      rates,
      currency: "EUR",
    });

    expect(r.valorCuentas).toBeCloseTo(10_900, 6);
    expect(r.valorInversiones).toBe(0);
    expect(r.deudaTotal).toBe(0);
    expect(r.patrimonioNeto).toBeCloseTo(10_900, 6);
  });

  it("resta hipoteca (capital prestado) y otras deudas", () => {
    const r = computeNetWorth({
      accounts: [cuenta("a", "EUR", true)],
      balances: new Map([["a", 10_000]]),
      investments: [],
      mortgage: hipotecaActiva,
      debts: [deuda(5_000, "EUR")],
      rates,
      currency: "EUR",
    });

    expect(r.deudaTotal).toBeCloseTo(185_000, 6); // 180k hipoteca + 5k deuda
    expect(r.patrimonioNeto).toBeCloseTo(10_000 - 185_000, 6);
  });

  it("hipoteca inactiva no cuenta como deuda", () => {
    const inactiva = { ...hipotecaActiva, activa: false } as Mortgage;
    const r = computeNetWorth({
      accounts: [],
      balances: new Map(),
      investments: [],
      mortgage: inactiva,
      debts: [deuda(5_000, "EUR")],
      rates,
      currency: "EUR",
    });
    expect(r.deudaTotal).toBeCloseTo(5_000, 6);
  });

  it("una moneda sin tipo de cambio se ignora sin romper", () => {
    const r = computeNetWorth({
      accounts: [cuenta("a", "EUR", true), cuenta("x", "JPY", true)],
      balances: new Map([
        ["a", 1_000],
        ["x", 999_999], // JPY no esta en rates -> se ignora
      ]),
      investments: [],
      mortgage: null,
      debts: [],
      rates,
      currency: "EUR",
    });
    expect(r.valorCuentas).toBeCloseTo(1_000, 6);
  });
});
