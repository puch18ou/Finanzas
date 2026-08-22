/**
 * tests/domain/forms-recurring.test.ts
 *
 * Tests del validador de "dias del mes" del formulario de reglas recurrentes.
 */

import { describe, it, expect } from "vitest";
import { parseDiasDelMesInput } from "@/lib/schemas/forms-recurring";

describe("parseDiasDelMesInput", () => {
  it("parsea lista valida", () => {
    expect(parseDiasDelMesInput("1,15")).toEqual([1, 15]);
  });
  it("tolera espacios", () => {
    expect(parseDiasDelMesInput(" 1 , 15 , 28 ")).toEqual([1, 15, 28]);
  });
  it("deduplica manteniendo el orden", () => {
    expect(parseDiasDelMesInput("15,1,15")).toEqual([15, 1]);
  });
  it("cadena vacia -> []", () => {
    expect(parseDiasDelMesInput("")).toEqual([]);
    expect(parseDiasDelMesInput("   ")).toEqual([]);
  });
  it("rechaza (null) valores fuera de 1-31", () => {
    expect(parseDiasDelMesInput("0")).toBeNull();
    expect(parseDiasDelMesInput("32")).toBeNull();
    expect(parseDiasDelMesInput("1,40")).toBeNull();
  });
  it("rechaza (null) tokens no numericos", () => {
    expect(parseDiasDelMesInput("1,foo")).toBeNull();
    expect(parseDiasDelMesInput("1.5")).toBeNull();
    expect(parseDiasDelMesInput("1,")).toBeNull();
  });
});
