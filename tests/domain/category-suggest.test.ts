/**
 * tests/domain/category-suggest.test.ts — sugerencia de categoria por concepto.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeConcepto,
  suggestCategoria,
  type ConceptoHistorial,
} from "@/lib/domain/category-suggest";

describe("normalizeConcepto", () => {
  it("minusculas, sin acentos, sin signos, espacios colapsados", () => {
    expect(normalizeConcepto("  Café  con   leche! ")).toBe("cafe con leche");
    expect(normalizeConcepto("MERCADONA")).toBe("mercadona");
    expect(normalizeConcepto("Nómina (Enero)")).toBe("nomina enero");
  });
});

const H = (concepto: string, categoriaId: string): ConceptoHistorial => ({
  concepto,
  categoriaId,
});

describe("suggestCategoria", () => {
  const historial: ConceptoHistorial[] = [
    H("Mercadona compra semanal", "super"),
    H("Mercadona", "super"),
    H("Cena restaurante con amigos", "ocio"),
    H("Gasolina coche", "transporte"),
    H("Mercadona online", "super"),
  ];

  it("concepto conocido -> categoria mas frecuente", () => {
    expect(suggestCategoria("Mercadona", historial)).toBe("super");
  });

  it("coincide por token compartido", () => {
    expect(suggestCategoria("restaurante japones", historial)).toBe("ocio");
    expect(suggestCategoria("gasolina", historial)).toBe("transporte");
  });

  it("insensible a acentos/mayusculas", () => {
    expect(suggestCategoria("MERCADÓNA", historial)).toBe("super");
  });

  it("sin coincidencia -> null", () => {
    expect(suggestCategoria("regalo cumpleanos", historial)).toBe(null);
  });

  it("concepto demasiado corto -> null", () => {
    expect(suggestCategoria("ab", historial)).toBe(null);
  });

  it("historial vacio -> null", () => {
    expect(suggestCategoria("Mercadona", [])).toBe(null);
  });

  it("empate de puntuacion -> gana la mas reciente (primer indice)", () => {
    // Misma fuerza de coincidencia (token 'taxi', sin match exacto) en dos
    // categorias distintas; gana la que aparece antes (mas reciente).
    const h: ConceptoHistorial[] = [
      H("Taxi centro", "transporte"),
      H("Taxi noche", "viajes"),
    ];
    expect(suggestCategoria("taxi", h)).toBe("transporte");
  });
});
