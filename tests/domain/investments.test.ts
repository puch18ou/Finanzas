/**
 * Tests de src/lib/domain/investments.ts (recalculo desde aportaciones).
 *
 * Ejecutar con: npm test
 */

import { describe, it, expect } from "vitest";
import { recomputeTotalsFromContributions } from "@/lib/domain/investments";

describe("recomputeTotalsFromContributions", () => {
  it("sin aportaciones devuelve cero", () => {
    expect(recomputeTotalsFromContributions([])).toEqual({
      participaciones: 0,
      precioMedio: 0,
    });
  });

  it("una sola aportacion: coste medio = su precio", () => {
    const r = recomputeTotalsFromContributions([
      { participaciones: 10, precioUnitario: 5 },
    ]);
    expect(r.participaciones).toBe(10);
    expect(r.precioMedio).toBe(5);
  });

  it("varias aportaciones: coste medio PONDERADO por participaciones", () => {
    // 10@5 (=50) + 30@9 (=270) => 40 part, coste 320 => medio 8
    const r = recomputeTotalsFromContributions([
      { participaciones: 10, precioUnitario: 5 },
      { participaciones: 30, precioUnitario: 9 },
    ]);
    expect(r.participaciones).toBe(40);
    expect(r.precioMedio).toBeCloseTo(8, 10);
  });

  it("participaciones totales 0 no divide por cero", () => {
    const r = recomputeTotalsFromContributions([
      { participaciones: 0, precioUnitario: 100 },
    ]);
    expect(r.participaciones).toBe(0);
    expect(r.precioMedio).toBe(0);
  });
});
