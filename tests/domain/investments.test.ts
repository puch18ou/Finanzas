/**
 * Tests de src/lib/domain/investments.ts (recalculo desde aportaciones).
 *
 * Ejecutar con: npm test
 */

import { describe, it, expect } from "vitest";
import {
  recomputeTotalsFromContributions,
  periodosTranscurridos,
  aplicarIntereses,
  avanzarFechaPeriodos,
} from "@/lib/domain/investments";

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

describe("periodosTranscurridos", () => {
  it("hasta <= desde devuelve 0", () => {
    const d = new Date(Date.UTC(2026, 0, 10, 12));
    expect(periodosTranscurridos(d, d, "mensual")).toBe(0);
    expect(
      periodosTranscurridos(d, new Date(d.getTime() - 1000), "mensual"),
    ).toBe(0);
  });

  it("mensual: cuenta meses completos por dia del mes", () => {
    const desde = new Date(Date.UTC(2026, 0, 25, 12)); // 25 ene
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 1, 24, 12)), "mensual"),
    ).toBe(0); // 24 feb: aun no cumple mes
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 1, 25, 12)), "mensual"),
    ).toBe(1); // 25 feb: 1 mes
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 5, 25, 12)), "mensual"),
    ).toBe(5); // 25 jun: 5 meses
  });

  it("trimestral: cuenta cada 3 meses completos", () => {
    const desde = new Date(Date.UTC(2026, 0, 10, 12));
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 2, 10, 12)), "trimestral"),
    ).toBe(0); // 2 meses
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 3, 10, 12)), "trimestral"),
    ).toBe(1); // 3 meses
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2026, 11, 10, 12)), "trimestral"),
    ).toBe(3); // 11 meses → 3 trimestres
  });

  it("anual: cuenta cada 12 meses completos", () => {
    const desde = new Date(Date.UTC(2024, 5, 15, 12));
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2025, 5, 14, 12)), "anual"),
    ).toBe(0); // dia anterior
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2025, 5, 15, 12)), "anual"),
    ).toBe(1);
    expect(
      periodosTranscurridos(desde, new Date(Date.UTC(2027, 5, 15, 12)), "anual"),
    ).toBe(3);
  });
});

describe("aplicarIntereses", () => {
  it("0 periodos: no cambia el precio", () => {
    expect(aplicarIntereses(1, 1, 3, "mensual", true, 0)).toBe(1);
    expect(aplicarIntereses(1, 1, 3, "mensual", false, 0)).toBe(1);
  });

  it("compuesto mensual 12% anual: tras 12 meses ≈ 1.1268", () => {
    // (1 + 0.12/12)^12 = (1.01)^12 ≈ 1.12683
    const r = aplicarIntereses(1, 1, 12, "mensual", true, 12);
    expect(r).toBeCloseTo(1.12683, 4);
  });

  it("simple mensual 12% anual: tras 12 meses = 1 + 0.12 = 1.12", () => {
    // simple: precioActual += precioCompra * (r/n) * periodos = 1*0.01*12 = 0.12
    const r = aplicarIntereses(1, 1, 12, "mensual", false, 12);
    expect(r).toBeCloseTo(1.12, 10);
  });

  it("compuesto y simple coinciden para 1 solo periodo", () => {
    const c = aplicarIntereses(1, 1, 6, "mensual", true, 1);
    const s = aplicarIntereses(1, 1, 6, "mensual", false, 1);
    expect(c).toBeCloseTo(s, 10);
  });

  it("anual compuesto: 5% anual durante 2 anios = 1.1025", () => {
    const r = aplicarIntereses(1, 1, 5, "anual", true, 2);
    expect(r).toBeCloseTo(1.1025, 4);
  });
});

describe("avanzarFechaPeriodos", () => {
  it("mensual: avanza N meses", () => {
    const d = new Date(Date.UTC(2026, 0, 25, 12));
    const next = avanzarFechaPeriodos(d, 3, "mensual");
    expect(next.getUTCFullYear()).toBe(2026);
    expect(next.getUTCMonth()).toBe(3); // abril
    expect(next.getUTCDate()).toBe(25);
  });

  it("trimestral: avanza N*3 meses", () => {
    const d = new Date(Date.UTC(2026, 0, 25, 12));
    const next = avanzarFechaPeriodos(d, 2, "trimestral");
    expect(next.getUTCMonth()).toBe(6); // julio
  });

  it("anual: avanza N anios", () => {
    const d = new Date(Date.UTC(2024, 5, 15, 12));
    const next = avanzarFechaPeriodos(d, 2, "anual");
    expect(next.getUTCFullYear()).toBe(2026);
    expect(next.getUTCMonth()).toBe(5);
  });

  it("0 periodos: devuelve la misma fecha", () => {
    const d = new Date(Date.UTC(2026, 0, 25, 12));
    expect(avanzarFechaPeriodos(d, 0, "mensual").getTime()).toBe(d.getTime());
  });
});
