/**
 * Tests de src/lib/domain/currency.ts
 *
 * Ejecutar con: npm test
 * Modo watch:   npm run test:watch
 */

import { describe, it, expect } from "vitest";
import {
  buildRatesMap,
  convert,
  formatAmount,
  recomputeRatesForNewView,
} from "@/lib/domain/currency";
import type { Currency } from "@/lib/db/schema";

// Fixture: rates contra EUR (1 SGD = 0.69 EUR, 1 USD = 0.92 EUR).
const ratesEur = {
  EUR: 1.0,
  SGD: 0.69,
  USD: 0.92,
};

describe("buildRatesMap", () => {
  it("construye un mapa a partir de una lista de currencies", () => {
    const currencies: Currency[] = [
      makeCurrency("EUR", 1.0),
      makeCurrency("USD", 0.92),
      makeCurrency("SGD", 0.69),
    ];
    expect(buildRatesMap(currencies)).toEqual({
      EUR: 1.0,
      USD: 0.92,
      SGD: 0.69,
    });
  });

  it("devuelve un mapa vacio si no hay currencies", () => {
    expect(buildRatesMap([])).toEqual({});
  });
});

describe("convert", () => {
  it("devuelve el mismo importe si la moneda origen y destino coinciden", () => {
    expect(convert(100, "EUR", "EUR", ratesEur)).toBe(100);
    expect(convert(50, "SGD", "SGD", ratesEur)).toBe(50);
  });

  it("convierte de SGD a EUR multiplicando por el rate de SGD", () => {
    // 100 SGD * 0.69 = 69 EUR
    expect(convert(100, "SGD", "EUR", ratesEur)).toBeCloseTo(69, 6);
  });

  it("convierte de EUR a SGD dividiendo por el rate de SGD", () => {
    // 69 EUR / 0.69 = 100 SGD
    expect(convert(69, "EUR", "SGD", ratesEur)).toBeCloseTo(100, 6);
  });

  it("convierte entre dos monedas no-vista pivotando por la moneda vista", () => {
    // 100 SGD → EUR: 100 * 0.69 = 69 EUR
    // 69 EUR → USD: 69 / 0.92 = 75 USD
    expect(convert(100, "SGD", "USD", ratesEur)).toBeCloseTo(75, 6);
  });

  it("lanza si la moneda origen no esta en el mapa", () => {
    expect(() => convert(100, "JPY", "EUR", ratesEur)).toThrow(/JPY/);
  });

  it("lanza si la moneda destino no esta en el mapa", () => {
    expect(() => convert(100, "EUR", "MXN", ratesEur)).toThrow(/MXN/);
  });

  it("respeta importes con muchos decimales", () => {
    const result = convert(123.456789, "SGD", "USD", ratesEur);
    const expected = (123.456789 * 0.69) / 0.92;
    expect(result).toBeCloseTo(expected, 10);
  });

  it("maneja correctamente importes cero", () => {
    expect(convert(0, "SGD", "USD", ratesEur)).toBe(0);
  });

  it("maneja correctamente importes negativos (e.g. devoluciones)", () => {
    expect(convert(-100, "SGD", "EUR", ratesEur)).toBeCloseTo(-69, 6);
  });
});

describe("formatAmount", () => {
  it("formatea EUR con simbolo y dos decimales por defecto", () => {
    // Diferentes browsers/locales producen "1.234,56 €" o "1.234,56 EUR".
    // No comprobamos string exacto; solo que contenga "1.234,56".
    expect(formatAmount(1234.56, "EUR")).toContain("1234,56");
  });

  it("respeta la opcion de decimales", () => {
    const result = formatAmount(10, "EUR", { decimals: 0 });
    expect(result).not.toContain(",");
  });

  it("no lanza con codigos custom (e.g. crypto)", () => {
    const result = formatAmount(1.5, "USDT");
    expect(result).toContain("USDT");
  });
});

describe("recomputeRatesForNewView", () => {
  it("la nueva moneda vista pasa a valer exactamente 1", () => {
    const newRates = recomputeRatesForNewView(ratesEur, "USD");
    expect(newRates.USD).toBe(1);
  });

  it("la antigua moneda vista pasa a su inverso", () => {
    // EUR antes valia 1, ahora deberia valer 1/0.92 ≈ 1.087
    const newRates = recomputeRatesForNewView(ratesEur, "USD");
    expect(newRates.EUR).toBeCloseTo(1 / 0.92, 6);
  });

  it("preserva las proporciones entre monedas", () => {
    // SGD/USD debe ser igual en ambos sistemas
    const ratioOld = ratesEur.SGD / ratesEur.USD;
    const newRates = recomputeRatesForNewView(ratesEur, "USD");
    const sgd = newRates.SGD;
    const usd = newRates.USD;
    expect(sgd).toBeDefined();
    expect(usd).toBeDefined();
    const ratioNew = sgd! / usd!;
    expect(ratioNew).toBeCloseTo(ratioOld, 10);
  });

  it("convert produce los mismos resultados antes y despues del recompute", () => {
    // Convertir 100 SGD a USD debe dar lo mismo con cualquier moneda vista.
    const before = convert(100, "SGD", "USD", ratesEur);

    const ratesUsd = recomputeRatesForNewView(ratesEur, "USD");
    const after = convert(100, "SGD", "USD", ratesUsd);

    expect(after).toBeCloseTo(before, 10);
  });

  it("lanza si la nueva moneda vista no esta en el mapa", () => {
    expect(() => recomputeRatesForNewView(ratesEur, "JPY")).toThrow(/JPY/);
  });
});

// Helper para construir un objeto Currency completo en tests.
function makeCurrency(code: string, tipoCambioVista: number): Currency {
  return {
    code,
    nombre: code,
    simbolo: code,
    tipoCambioVista,
    orden: 0,
    activa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
