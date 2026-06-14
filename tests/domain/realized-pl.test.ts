/**
 * tests/domain/realized-pl.test.ts — plusvalias realizadas en ventas.
 */

import { describe, it, expect } from "vitest";
import { realizedGain, sumRealizedPL } from "@/lib/domain/investments";

describe("realizedGain", () => {
  it("ganancia: dinero recibido > coste vendido", () => {
    // Vendes 10 ud por 120 (12/ud); coste medio 10/ud -> +20.
    expect(realizedGain(120, 10, 10)).toBe(20);
  });
  it("perdida: dinero recibido < coste vendido", () => {
    expect(realizedGain(80, 10, 10)).toBe(-20);
  });
  it("a coste = sin plusvalia", () => {
    expect(realizedGain(100, 10, 10)).toBe(0);
  });
});

describe("sumRealizedPL", () => {
  it("suma solo las retiradas; ignora aportaciones y nulls", () => {
    const contribs = [
      { esRetirada: false, plusvaliaRealizada: null }, // aportacion -> ignora
      { esRetirada: true, plusvaliaRealizada: 30 },
      { esRetirada: true, plusvaliaRealizada: -10 },
      { esRetirada: true, plusvaliaRealizada: null }, // retirada vieja sin dato
    ];
    expect(sumRealizedPL(contribs)).toBe(20);
  });
  it("sin retiradas -> 0", () => {
    expect(sumRealizedPL([{ esRetirada: false, plusvaliaRealizada: null }])).toBe(0);
    expect(sumRealizedPL([])).toBe(0);
  });
});
