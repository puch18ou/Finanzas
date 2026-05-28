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
    cuentaOrigenId: string | null;
    cuentaDestinoId: string | null;
    deletedAt: Date | string | null;
  }>,
) => ({
  importe: 0,
  cuentaOrigenId: null,
  cuentaDestinoId: null,
  deletedAt: null,
  ...partial,
});

describe("computeNetImpactByAccount", () => {
  it("gasto resta de la cuenta origen", () => {
    const impact = computeNetImpactByAccount([
      mov({ importe: 100, cuentaOrigenId: "a" }),
    ]);
    expect(impact.get("a")).toBe(-100);
  });

  it("ingreso suma a la cuenta destino", () => {
    const impact = computeNetImpactByAccount([
      mov({ importe: 50, cuentaDestinoId: "a" }),
    ]);
    expect(impact.get("a")).toBe(50);
  });

  it("transferencia resta del origen y suma al destino", () => {
    const impact = computeNetImpactByAccount([
      mov({ importe: 200, cuentaOrigenId: "a", cuentaDestinoId: "b" }),
    ]);
    expect(impact.get("a")).toBe(-200);
    expect(impact.get("b")).toBe(200);
  });

  it("ignora movimientos borrados", () => {
    const impact = computeNetImpactByAccount([
      mov({ importe: 100, cuentaOrigenId: "a", deletedAt: new Date() }),
    ]);
    expect(impact.get("a")).toBeUndefined();
  });

  it("acumula varios movimientos sobre la misma cuenta", () => {
    const impact = computeNetImpactByAccount([
      mov({ importe: 100, cuentaDestinoId: "a" }),
      mov({ importe: 30, cuentaOrigenId: "a" }),
      mov({ importe: 20, cuentaOrigenId: "a" }),
    ]);
    expect(impact.get("a")).toBe(50);
  });
});

describe("computeAccountBalances", () => {
  it("sin movimientos, el saldo es el saldo inicial", () => {
    const balances = computeAccountBalances(
      [{ id: "a", saldoInicial: 1000 }],
      [],
    );
    expect(balances.get("a")).toBe(1000);
  });

  it("saldo = saldoInicial + impacto neto", () => {
    const balances = computeAccountBalances(
      [
        { id: "a", saldoInicial: 1000 },
        { id: "b", saldoInicial: 0 },
      ],
      [
        mov({ importe: 300, cuentaOrigenId: "a", cuentaDestinoId: "b" }),
        mov({ importe: 50, cuentaOrigenId: "a" }),
      ],
    );
    expect(balances.get("a")).toBe(650); // 1000 - 300 - 50
    expect(balances.get("b")).toBe(300); // 0 + 300
  });

  it("cuentas sin movimientos conservan su saldo inicial", () => {
    const balances = computeAccountBalances(
      [{ id: "a", saldoInicial: -500 }],
      [mov({ importe: 100, cuentaOrigenId: "otra" })],
    );
    expect(balances.get("a")).toBe(-500);
  });
});
