/**
 * Tests de tramos.ts — valores con vigencia (objetivo de ahorro y presupuesto).
 */

import { describe, it, expect } from "vitest";
import {
  resolveTramo,
  tramosAncla,
  ordenarTramos,
  resolvePresupuesto,
} from "@/lib/domain/tramos";

type T = { desdeAnio: number | null; desdeMes: number | null; v: number };

const t = (desdeAnio: number | null, desdeMes: number | null, v: number): T => ({
  desdeAnio,
  desdeMes,
  v,
});

describe("resolveTramo", () => {
  it("devuelve null si no hay tramos", () => {
    expect(resolveTramo([], 2026, 6)).toBeNull();
  });

  it("base (desde siempre) aplica a cualquier mes", () => {
    const tramos = [t(null, null, 10)];
    expect(resolveTramo(tramos, 2020, 1)?.v).toBe(10);
    expect(resolveTramo(tramos, 2030, 12)?.v).toBe(10);
  });

  it("elige el tramo con mayor desde <= (anio,mes)", () => {
    const tramos = [t(null, null, 10), t(2026, 3, 20), t(2026, 9, 30)];
    expect(resolveTramo(tramos, 2026, 1)?.v).toBe(10); // antes de marzo -> base
    expect(resolveTramo(tramos, 2026, 3)?.v).toBe(20); // justo en marzo
    expect(resolveTramo(tramos, 2026, 8)?.v).toBe(20); // entre marzo y sept
    expect(resolveTramo(tramos, 2026, 9)?.v).toBe(30); // desde sept
    expect(resolveTramo(tramos, 2027, 1)?.v).toBe(30); // sigue arrastrando
  });

  it("sin base: meses anteriores al primer tramo dan null", () => {
    const tramos = [t(2026, 3, 20)];
    expect(resolveTramo(tramos, 2026, 2)).toBeNull();
    expect(resolveTramo(tramos, 2026, 3)?.v).toBe(20);
  });

  it("cruza anios correctamente", () => {
    const tramos = [t(2025, 11, 5), t(2026, 2, 7)];
    expect(resolveTramo(tramos, 2025, 12)?.v).toBe(5);
    expect(resolveTramo(tramos, 2026, 1)?.v).toBe(5);
    expect(resolveTramo(tramos, 2026, 2)?.v).toBe(7);
  });
});

describe("tramosAncla", () => {
  it("null si no hay tramos", () => {
    expect(tramosAncla([])).toBeNull();
  });

  it("null si existe un tramo base (desde siempre)", () => {
    expect(tramosAncla([t(null, null, 10), t(2026, 3, 20)])).toBeNull();
  });

  it("primer mes con fecha si no hay base", () => {
    expect(tramosAncla([t(2026, 9, 30), t(2026, 3, 20)])).toEqual({
      anio: 2026,
      mes: 3,
    });
  });
});

describe("ordenarTramos", () => {
  it("base primero, luego por fecha asc", () => {
    const out = ordenarTramos([t(2026, 9, 30), t(null, null, 10), t(2026, 3, 20)]);
    expect(out.map((x) => x.v)).toEqual([10, 20, 30]);
  });
});

describe("resolvePresupuesto (hibrido base + cambios)", () => {
  const base = { importe: 100, moneda: "EUR" };

  it("sin cambios -> base", () => {
    expect(resolvePresupuesto([], base.importe, base.moneda, 2026, 6)).toEqual({
      importe: 100,
      moneda: "EUR",
    });
  });

  it("antes del primer cambio -> base; despues -> cambio", () => {
    const tramos = [
      { desdeAnio: 2026, desdeMes: 5, importe: 150, moneda: "USD" },
    ];
    expect(
      resolvePresupuesto(tramos, base.importe, base.moneda, 2026, 4),
    ).toEqual({ importe: 100, moneda: "EUR" });
    expect(
      resolvePresupuesto(tramos, base.importe, base.moneda, 2026, 5),
    ).toEqual({ importe: 150, moneda: "USD" });
  });
});
