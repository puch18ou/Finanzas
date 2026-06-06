/**
 * tests/domain/aggregation.test.ts — gastos/ingresos y devoluciones.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeMonth,
  sumMovementsByCategory,
} from "@/lib/domain/aggregation";
import type { Movement } from "@/lib/db/schema";

const RATES = { EUR: 1 } as Record<string, number>;

const mov = (p: Partial<Movement>): Movement =>
  ({
    id: "x",
    tipo: "gasto",
    importe: 0,
    moneda: "EUR",
    mes: 1,
    anio: 2026,
    categoriaId: null,
    ...p,
  }) as unknown as Movement;

describe("summarizeMonth con devoluciones", () => {
  it("la devolucion resta del gasto, no cuenta como ingreso", () => {
    const movs = [
      mov({ tipo: "gasto", importe: 100 }),
      mov({ tipo: "devolucion", importe: 30 }),
    ];
    const s = summarizeMonth({ mes: 1, anio: 2026, movements: movs, rates: RATES, viewCurrency: "EUR" });
    expect(s.gastos).toBe(70);
    expect(s.ingresos).toBe(0);
    expect(s.ahorro).toBe(-70);
  });

  it("con ingreso: la devolucion mejora el ahorro bajando el gasto", () => {
    const movs = [
      mov({ tipo: "ingreso", importe: 200 }),
      mov({ tipo: "gasto", importe: 100 }),
      mov({ tipo: "devolucion", importe: 40 }),
    ];
    const s = summarizeMonth({ mes: 1, anio: 2026, movements: movs, rates: RATES, viewCurrency: "EUR" });
    expect(s.ingresos).toBe(200);
    expect(s.gastos).toBe(60);
    expect(s.ahorro).toBe(140);
  });

  it("devolucion sin gasto deja gasto neto negativo", () => {
    const movs = [mov({ tipo: "devolucion", importe: 25 })];
    const s = summarizeMonth({ mes: 1, anio: 2026, movements: movs, rates: RATES, viewCurrency: "EUR" });
    expect(s.gastos).toBe(-25);
  });
});

describe("sumMovementsByCategory con devoluciones", () => {
  it("la devolucion resta del neto de su categoria", () => {
    const movs = [
      mov({ tipo: "gasto", importe: 100, categoriaId: "ropa" }),
      mov({ tipo: "devolucion", importe: 40, categoriaId: "ropa" }),
      mov({ tipo: "gasto", importe: 20, categoriaId: "ocio" }),
    ];
    const byCat = sumMovementsByCategory(movs, RATES, "EUR");
    expect(byCat["ropa"]).toBe(60);
    expect(byCat["ocio"]).toBe(20);
  });

  it("un ingreso normal no entra en el desglose de gasto por categoria", () => {
    const movs = [mov({ tipo: "ingreso", importe: 500, categoriaId: "ropa" })];
    const byCat = sumMovementsByCategory(movs, RATES, "EUR");
    expect(byCat["ropa"]).toBeUndefined();
  });
});
