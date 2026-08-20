/**
 * tests/domain/aggregation.test.ts — gastos/ingresos y devoluciones.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeMonth,
  sumMovementsByCategory,
  listMovementsByCategory,
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

describe("listMovementsByCategory (desglose del presupuesto)", () => {
  const RATES2 = { EUR: 1, USD: 0.5 } as Record<string, number>;

  it("una devolucion SUELTA (sin gasto asociado) sale como linea propia", () => {
    const movs = [
      mov({ id: "a", tipo: "gasto", importe: 30, categoriaId: "ropa" }),
      mov({ id: "b", tipo: "gasto", importe: 100, categoriaId: "ropa" }),
      mov({ id: "c", tipo: "devolucion", importe: 40, categoriaId: "ropa" }),
      mov({ id: "d", tipo: "gasto", importe: 20, categoriaId: "ocio" }),
    ];
    const byCat = listMovementsByCategory(movs, RATES2, "EUR");
    const ropa = byCat["ropa"]!;
    const ocio = byCat["ocio"]!;

    // Orden por valorVista desc: gasto 100, gasto 30, devolucion suelta -40.
    expect(ropa.map((i) => i.movement.id)).toEqual(["b", "a", "c"]);
    expect(ropa.map((i) => i.valorVista)).toEqual([100, 30, -40]);
    expect(ropa.map((i) => i.importeNeto)).toEqual([100, 30, 40]);

    // La suma del desglose coincide con sumMovementsByCategory.
    const sumRopa = ropa.reduce((s, i) => s + i.valorVista, 0);
    expect(sumRopa).toBe(sumMovementsByCategory(movs, RATES2, "EUR")["ropa"]);
    expect(ocio.map((i) => i.movement.id)).toEqual(["d"]);
  });

  it("una devolucion ASOCIADA se funde en su gasto (coste real, una sola linea)", () => {
    const movs = [
      mov({ id: "g", tipo: "gasto", importe: 100, categoriaId: "ropa" }),
      mov({
        id: "r",
        tipo: "devolucion",
        importe: 40,
        categoriaId: "ropa",
        gastoAsociadoId: "g",
      }),
    ];
    const byCat = listMovementsByCategory(movs, RATES2, "EUR");
    const ropa = byCat["ropa"]!;

    // Solo UNA linea (el gasto), la devolucion asociada no sale suelta.
    expect(ropa).toHaveLength(1);
    expect(ropa[0]!.movement.id).toBe("g");
    expect(ropa[0]!.importeNeto).toBe(60); // 100 - 40 = coste real
    expect(ropa[0]!.devuelto).toBe(40);
    expect(ropa[0]!.valorVista).toBe(60);

    // Sigue cuadrando con la suma neta de la categoria.
    expect(ropa[0]!.valorVista).toBe(
      sumMovementsByCategory(movs, RATES2, "EUR")["ropa"],
    );
  });

  it("devolucion asociada en OTRA moneda se convierte a la del gasto", () => {
    // Gasto 100 EUR, devolucion 40 USD -> 20 EUR. Coste real 80 EUR.
    const movs = [
      mov({ id: "g", tipo: "gasto", importe: 100, moneda: "EUR", categoriaId: "x" }),
      mov({
        id: "r",
        tipo: "devolucion",
        importe: 40,
        moneda: "USD",
        categoriaId: "x",
        gastoAsociadoId: "g",
      }),
    ];
    const byCat = listMovementsByCategory(movs, RATES2, "EUR");
    const x = byCat["x"]!;
    expect(x).toHaveLength(1);
    expect(x[0]!.importeNeto).toBe(80);
    expect(x[0]!.devuelto).toBe(20);
    expect(x[0]!.valorVista).toBe(80);
  });

  it("convierte a moneda vista al ordenar y sumar", () => {
    // 100 USD -> 50 EUR; 60 EUR se queda en 60 -> el de 60 EUR va primero.
    const movs = [
      mov({ id: "u", tipo: "gasto", importe: 100, moneda: "USD", categoriaId: "x" }),
      mov({ id: "e", tipo: "gasto", importe: 60, moneda: "EUR", categoriaId: "x" }),
    ];
    const byCat = listMovementsByCategory(movs, RATES2, "EUR");
    const x = byCat["x"]!;
    expect(x.map((i) => i.movement.id)).toEqual(["e", "u"]);
    expect(x.map((i) => i.valorVista)).toEqual([60, 50]);
  });

  it("ignora tipos que no son gasto/cuota/devolucion y los sin categoria", () => {
    const movs = [
      mov({ tipo: "ingreso", importe: 500, categoriaId: "x" }),
      mov({ tipo: "transferencia", importe: 500, categoriaId: "x" }),
      mov({ tipo: "gasto", importe: 10, categoriaId: null }),
    ];
    const byCat = listMovementsByCategory(movs, RATES2, "EUR");
    expect(Object.keys(byCat)).toHaveLength(0);
  });
});
