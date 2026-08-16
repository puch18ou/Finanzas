import { describe, it, expect } from "vitest";
import {
  costeReal,
  tieneDevoluciones,
  sumRefundsInCurrency,
} from "@/lib/domain/refunds";
import type { RatesMap } from "@/lib/domain/currency";

// EUR moneda vista (=1); 1 SGD = 0.69 EUR, 1 USD = 0.92 EUR.
const RATES: RatesMap = { EUR: 1, SGD: 0.69, USD: 0.92 };

describe("sumRefundsInCurrency", () => {
  it("suma devoluciones en la misma moneda sin convertir", () => {
    expect(
      sumRefundsInCurrency(
        [
          { importe: 10, moneda: "EUR" },
          { importe: 5, moneda: "EUR" },
        ],
        "EUR",
        RATES,
      ),
    ).toBe(15);
  });

  it("convierte devoluciones en otra divisa a la moneda del gasto", () => {
    // Gasto en EUR, devolucion de 10 USD -> 10 * 0.92 = 9.2 EUR.
    expect(
      sumRefundsInCurrency([{ importe: 10, moneda: "USD" }], "EUR", RATES),
    ).toBeCloseTo(9.2, 6);
  });

  it("mezcla monedas: convierte cada una a la del gasto", () => {
    // Gasto en EUR: 10 EUR + 10 USD(=9.2) + 100 SGD(=69) = 88.2 EUR.
    expect(
      sumRefundsInCurrency(
        [
          { importe: 10, moneda: "EUR" },
          { importe: 10, moneda: "USD" },
          { importe: 100, moneda: "SGD" },
        ],
        "EUR",
        RATES,
      ),
    ).toBeCloseTo(88.2, 6);
  });

  it("lista vacia = 0", () => {
    expect(sumRefundsInCurrency([], "EUR", RATES)).toBe(0);
  });
});

describe("costeReal", () => {
  it("resta las devoluciones al importe del gasto", () => {
    expect(costeReal(50, 10)).toBe(40);
  });

  it("sin devoluciones, el coste real es el importe", () => {
    expect(costeReal(50, 0)).toBe(50);
  });

  it("nunca baja de 0 aunque devuelvan de mas", () => {
    expect(costeReal(50, 70)).toBe(0);
  });
});

describe("tieneDevoluciones", () => {
  it("true solo si hay algo devuelto", () => {
    expect(tieneDevoluciones(0)).toBe(false);
    expect(tieneDevoluciones(5)).toBe(true);
  });
});
