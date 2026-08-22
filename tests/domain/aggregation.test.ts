/**
 * tests/domain/aggregation.test.ts — gastos/ingresos y devoluciones.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeMonth,
  sumMovementsByCategory,
  listMovementsByCategory,
  compareYearsByMonth,
  totalsByYear,
  categorySeriesByMonth,
  previstosDelMes,
} from "@/lib/domain/aggregation";
import type { Movement, RecurringRule } from "@/lib/db/schema";

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

describe("compareYearsByMonth (comparar años)", () => {
  it("devuelve 12 filas con el valor de la metrica por año", () => {
    const movs = [
      mov({ tipo: "gasto", importe: 100, mes: 3, anio: 2025 }),
      mov({ tipo: "gasto", importe: 150, mes: 3, anio: 2026 }),
      mov({ tipo: "gasto", importe: 50, mes: 7, anio: 2025 }),
    ];
    const rows = compareYearsByMonth(movs, [2025, 2026], "gastos", RATES, "EUR");
    expect(rows).toHaveLength(12);
    const marzo = rows.find((r) => r.mes === 3)!;
    expect(marzo.values[2025]).toBe(100);
    expect(marzo.values[2026]).toBe(150);
    const julio = rows.find((r) => r.mes === 7)!;
    expect(julio.values[2025]).toBe(50);
    expect(julio.values[2026]).toBe(0);
  });

  it("metrica ahorro = ingresos - gastos", () => {
    const movs = [
      mov({ tipo: "ingreso", importe: 300, mes: 1, anio: 2026 }),
      mov({ tipo: "gasto", importe: 100, mes: 1, anio: 2026 }),
    ];
    const rows = compareYearsByMonth(movs, [2026], "ahorro", RATES, "EUR");
    expect(rows.find((r) => r.mes === 1)!.values[2026]).toBe(200);
  });

  it("totalsByYear suma los 12 meses", () => {
    const movs = [
      mov({ tipo: "gasto", importe: 100, mes: 3, anio: 2025 }),
      mov({ tipo: "gasto", importe: 50, mes: 7, anio: 2025 }),
      mov({ tipo: "gasto", importe: 150, mes: 3, anio: 2026 }),
    ];
    const rows = compareYearsByMonth(movs, [2025, 2026], "gastos", RATES, "EUR");
    const totals = totalsByYear(rows, [2025, 2026]);
    expect(totals[2025]).toBe(150);
    expect(totals[2026]).toBe(150);
  });
});

describe("previstosDelMes", () => {
  const rule = (p: Partial<RecurringRule>): RecurringRule =>
    ({
      id: "r",
      nombre: "regla",
      tipoMovimiento: "gasto",
      importe: 0,
      moneda: "EUR",
      categoriaId: null,
      diaDelMes: 15,
      frecuencia: "mensual",
      diaSemana: null,
      diasDelMes: null,
      mesDelAnio: null,
      fechaInicio: new Date(Date.UTC(2025, 0, 1, 12)),
      fechaFin: null,
      activa: true,
      origenAutomatico: null,
      ...p,
    }) as unknown as RecurringRule;

  it("suma ocurrencias futuras del mes (gasto e ingreso)", () => {
    const now = new Date(Date.UTC(2026, 2, 10, 12)); // 10/03/2026
    const rules = [
      rule({ id: "g", tipoMovimiento: "gasto", importe: 50, diaDelMes: 25, categoriaId: "transporte" }),
      rule({ id: "i", tipoMovimiento: "ingreso", importe: 1000, diaDelMes: 28 }),
    ];
    const p = previstosDelMes(rules, 2026, 3, now, RATES, "EUR");
    expect(p.gastos).toBe(50);
    expect(p.ingresos).toBe(1000);
    expect(p.porCategoria["transporte"]).toBe(50);
  });

  it("ignora ocurrencias ya pasadas", () => {
    const now = new Date(Date.UTC(2026, 2, 26, 12)); // 26/03, ya paso el dia 25
    const rules = [rule({ tipoMovimiento: "gasto", importe: 50, diaDelMes: 25 })];
    const p = previstosDelMes(rules, 2026, 3, now, RATES, "EUR");
    expect(p.gastos).toBe(0);
  });

  it("excluye reglas de inversion e inactivas", () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12));
    const rules = [
      rule({ tipoMovimiento: "gasto", importe: 50, diaDelMes: 25, origenAutomatico: "investment" }),
      rule({ tipoMovimiento: "gasto", importe: 30, diaDelMes: 25, activa: false }),
    ];
    const p = previstosDelMes(rules, 2026, 3, now, RATES, "EUR");
    expect(p.gastos).toBe(0);
  });

  it("semanal: suma cada ocurrencia futura del mes", () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12)); // 01/03/2026
    const rules = [
      rule({ tipoMovimiento: "gasto", importe: 10, frecuencia: "semanal", diaSemana: 1 }),
    ];
    // Lunes de marzo 2026 futuros: 2,9,16,23,30 = 5 -> 50
    const p = previstosDelMes(rules, 2026, 3, now, RATES, "EUR");
    expect(p.gastos).toBe(50);
  });
});

describe("categorySeriesByMonth (por categoria mes a mes)", () => {
  it("gasto neto por categoria y periodo, con devoluciones restadas", () => {
    const movs = [
      mov({ tipo: "gasto", importe: 100, categoriaId: "transporte", mes: 3, anio: 2026 }),
      mov({ tipo: "devolucion", importe: 20, categoriaId: "transporte", mes: 3, anio: 2026 }),
      mov({ tipo: "gasto", importe: 40, categoriaId: "ocio", mes: 3, anio: 2026 }),
      mov({ tipo: "gasto", importe: 60, categoriaId: "transporte", mes: 4, anio: 2026 }),
    ];
    const periods = [
      { anio: 2026, mes: 3 },
      { anio: 2026, mes: 4 },
    ];
    const rows = categorySeriesByMonth(
      movs,
      ["transporte", "ocio"],
      periods,
      RATES,
      "EUR",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.values["transporte"]).toBe(80); // 100 - 20
    expect(rows[0]!.values["ocio"]).toBe(40);
    expect(rows[1]!.values["transporte"]).toBe(60);
    expect(rows[1]!.values["ocio"]).toBe(0); // sin gasto ese mes -> 0
  });
});
