import { describe, it, expect } from "vitest";
import {
  planBudgetConversion,
} from "@/lib/services/budget-currency-service";
import type { RatesMap } from "@/lib/domain/currency";

// EUR es la moneda vista (=1); 1 SGD = 0.69 EUR, 1 USD = 0.92 EUR.
const RATES: RatesMap = { EUR: 1, SGD: 0.69, USD: 0.92 };

describe("planBudgetConversion", () => {
  it("convierte solo lo que NO esta ya en la moneda local, al cambio", () => {
    const plan = planBudgetConversion(
      [
        { id: "c1", presupuestoMensual: 600, presupuestoMoneda: "SGD" },
        { id: "c2", presupuestoMensual: 100, presupuestoMoneda: "EUR" }, // ya local
      ],
      [{ id: "t1", importe: 250, moneda: "SGD" }],
      "EUR",
      RATES,
    );

    // 600 SGD * 0.69 = 414 EUR; el tramo 250 SGD -> 172.5 EUR.
    expect(plan.categorias).toEqual([{ id: "c1", nuevoImporte: 414 }]);
    expect(plan.tramos).toEqual([{ id: "t1", nuevoImporte: 172.5 }]);
  });

  it("es idempotente: si todo esta ya en la moneda local, no convierte nada", () => {
    const plan = planBudgetConversion(
      [{ id: "c1", presupuestoMensual: 414, presupuestoMoneda: "EUR" }],
      [{ id: "t1", importe: 172.5, moneda: "EUR" }],
      "EUR",
      RATES,
    );
    expect(plan.categorias).toEqual([]);
    expect(plan.tramos).toEqual([]);
  });

  it("redondea a 2 decimales", () => {
    // 100 USD * 0.92 = 92 EUR exacto; 33 USD * 0.92 = 30.36.
    const plan = planBudgetConversion(
      [{ id: "c1", presupuestoMensual: 33, presupuestoMoneda: "USD" }],
      [],
      "EUR",
      RATES,
    );
    expect(plan.categorias).toEqual([{ id: "c1", nuevoImporte: 30.36 }]);
  });
});
