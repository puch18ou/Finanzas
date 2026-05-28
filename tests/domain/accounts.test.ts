/**
 * tests/domain/accounts.test.ts
 *
 * Tests del saldo calculado de cuentas (Lote 10b).
 */

import { describe, it, expect } from "vitest";
import {
  computeAccountBalances,
  computeNetImpactByAccount,
} from "@/lib/domain/accounts";

const mov = (
  partial: Partial<{
    importe: number;
    moneda: string;
    cuentaOrigenId: string | null;
    cuentaDestinoId: string | null;
    deletedAt: Date | string | null;
  }>,
) => ({
  importe: 0,
  moneda: "EUR",
  cuentaOrigenId: null,
  cuentaDestinoId: null,
  deletedAt: null,
  ...partial,
});

// Tipos de cambio de prueba (moneda vista = EUR): 1 SGD = 0.69 EUR.
const RATES = { EUR: 1, SGD: 0.69 };

describe("computeNetImpactByAccount", () => {
  it("gasto resta de la cuenta origen", () => {
    const impact = computeNetImpactByAccount(
      [{ id: "a", moneda: "EUR" }],
      [mov({ importe: 100, cuentaOrigenId: "a" })],
      RATES,
    );
    expect(impact.get("a")).toBe(-100);
  });

  it("ingreso suma a la cuenta destino", () => {
    const impact = computeNetImpactByAccount(
      [{ id: "a", moneda: "EUR" }],
      [mov({ importe: 50, cuentaDestinoId: "a" })],
      RATES,
    );
    expect(impact.get("a")).toBe(50);
  });

  it("transferencia resta del origen y suma al destino", () => {
    const impact = computeNetImpactByAccount(
      [
        { id: "a", moneda: "EUR" },
        { id: "b", moneda: "EUR" },
      ],
      [mov({ importe: 200, cuentaOrigenId: "a", cuentaDestinoId: "b" })],
      RATES,
    );
    expect(impact.get("a")).toBe(-200);
    expect(impact.get("b")).toBe(200);
  });

  it("ignora movimientos borrados", () => {
    const impact = computeNetImpactByAccount(
      [{ id: "a", moneda: "EUR" }],
      [mov({ importe: 100, cuentaOrigenId: "a", deletedAt: new Date() })],
      RATES,
    );
    expect(impact.get("a")).toBeUndefined();
  });

  it("acumula varios movimientos sobre la misma cuenta", () => {
    const impact = computeNetImpactByAccount(
      [{ id: "a", moneda: "EUR" }],
      [
        mov({ importe: 100, cuentaDestinoId: "a" }),
        mov({ importe: 30, cuentaOrigenId: "a" }),
        mov({ importe: 20, cuentaOrigenId: "a" }),
      ],
      RATES,
    );
    expect(impact.get("a")).toBe(50);
  });

  it("convierte el importe a la moneda de la cuenta", () => {
    // Gasto de 50 EUR desde una cuenta en SGD: 50 / 0.69 = 72.46... SGD.
    const impact = computeNetImpactByAccount(
      [{ id: "a", moneda: "SGD" }],
      [mov({ importe: 50, moneda: "EUR", cuentaOrigenId: "a" })],
      RATES,
    );
    expect(impact.get("a")).toBeCloseTo(-72.463768, 4);
  });
});

describe("computeAccountBalances", () => {
  it("sin movimientos, el saldo es el saldo inicial", () => {
    const balances = computeAccountBalances(
      [{ id: "a", saldoInicial: 1000, moneda: "EUR" }],
      [],
      RATES,
    );
    expect(balances.get("a")).toBe(1000);
  });

  it("saldo = saldoInicial + impacto neto (misma moneda)", () => {
    const balances = computeAccountBalances(
      [
        { id: "a", saldoInicial: 1000, moneda: "EUR" },
        { id: "b", saldoInicial: 0, moneda: "EUR" },
      ],
      [
        mov({ importe: 300, cuentaOrigenId: "a", cuentaDestinoId: "b" }),
        mov({ importe: 50, cuentaOrigenId: "a" }),
      ],
      RATES,
    );
    expect(balances.get("a")).toBe(650); // 1000 - 300 - 50
    expect(balances.get("b")).toBe(300); // 0 + 300
  });

  it("convierte gastos en otra divisa al calcular el saldo", () => {
    // Cuenta SGD con saldo inicial 1000 SGD y un gasto de 50 EUR.
    const balances = computeAccountBalances(
      [{ id: "a", saldoInicial: 1000, moneda: "SGD" }],
      [mov({ importe: 50, moneda: "EUR", cuentaOrigenId: "a" })],
      RATES,
    );
    expect(balances.get("a")).toBeCloseTo(1000 - 72.463768, 4);
  });

  it("cuentas sin movimientos conservan su saldo inicial", () => {
    const balances = computeAccountBalances(
      [{ id: "a", saldoInicial: -500, moneda: "EUR" }],
      [mov({ importe: 100, cuentaOrigenId: "otra" })],
      RATES,
    );
    expect(balances.get("a")).toBe(-500);
  });
});
