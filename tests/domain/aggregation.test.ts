/**
 * Tests de src/lib/domain/aggregation.ts
 */

import { describe, it, expect } from "vitest";
import {
  sumExpensesInView,
  filterExpensesByPeriod,
  sumExpensesByCategory,
  sumMonthlyIncomeInView,
  sumExtraIncomesInView,
  summarizeMonth,
} from "@/lib/domain/aggregation";
import type {
  Expense,
  MonthlyIncome,
  ExtraIncome,
} from "@/lib/db/schema";

// Rates contra EUR
const rates = { EUR: 1.0, SGD: 0.69, USD: 0.92 };

// Helpers
function makeExpense(
  partial: Partial<Expense> & Pick<Expense, "importe" | "moneda" | "mes" | "anio">,
): Expense {
  return {
    id: partial.id ?? "e1",
    fecha: new Date(),
    concepto: partial.concepto ?? "Test",
    categoriaId: partial.categoriaId ?? "cat1",
    cuentaId: null,
    notas: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  };
}

function makeMonthlyIncome(p: Partial<MonthlyIncome> & Pick<MonthlyIncome, "anio" | "mes" | "salario" | "moneda">): MonthlyIncome {
  return {
    id: p.id ?? "i1",
    bonus: 0,
    otros: 0,
    notas: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...p,
  };
}

function makeExtra(p: Partial<ExtraIncome> & Pick<ExtraIncome, "importe" | "moneda" | "mes" | "anio">): ExtraIncome {
  return {
    id: p.id ?? "x1",
    fecha: new Date(),
    concepto: p.concepto ?? "Extra",
    categoria: p.categoria ?? "Bonus",
    tipo: "Ingreso extra",
    notas: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...p,
  };
}

describe("filterExpensesByPeriod", () => {
  it("filtra correctamente por mes y anio", () => {
    const list = [
      makeExpense({ id: "a", importe: 10, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExpense({ id: "b", importe: 20, moneda: "EUR", mes: 2, anio: 2026 }),
      makeExpense({ id: "c", importe: 30, moneda: "EUR", mes: 1, anio: 2025 }),
      makeExpense({ id: "d", importe: 40, moneda: "EUR", mes: 1, anio: 2026 }),
    ];
    const out = filterExpensesByPeriod(list, 1, 2026);
    expect(out.map((e) => e.id)).toEqual(["a", "d"]);
  });

  it("ignora gastos soft-deleted", () => {
    const list = [
      makeExpense({ id: "a", importe: 10, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExpense({
        id: "b",
        importe: 20,
        moneda: "EUR",
        mes: 1,
        anio: 2026,
        deletedAt: new Date(),
      }),
    ];
    const out = filterExpensesByPeriod(list, 1, 2026);
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("sumExpensesInView", () => {
  it("suma gastos en una sola moneda sin conversion", () => {
    const list = [
      makeExpense({ importe: 10, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExpense({ importe: 20, moneda: "EUR", mes: 1, anio: 2026 }),
    ];
    expect(sumExpensesInView(list, rates, "EUR")).toBeCloseTo(30, 6);
  });

  it("convierte cada gasto a la moneda vista antes de sumar", () => {
    const list = [
      makeExpense({ importe: 100, moneda: "SGD", mes: 1, anio: 2026 }), // 69 EUR
      makeExpense({ importe: 100, moneda: "USD", mes: 1, anio: 2026 }), // 92 EUR
    ];
    expect(sumExpensesInView(list, rates, "EUR")).toBeCloseTo(161, 4);
  });

  it("ignora gastos soft-deleted", () => {
    const list = [
      makeExpense({ importe: 10, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExpense({
        importe: 999,
        moneda: "EUR",
        mes: 1,
        anio: 2026,
        deletedAt: new Date(),
      }),
    ];
    expect(sumExpensesInView(list, rates, "EUR")).toBe(10);
  });

  it("devuelve 0 con lista vacia", () => {
    expect(sumExpensesInView([], rates, "EUR")).toBe(0);
  });
});

describe("sumExpensesByCategory", () => {
  it("agrupa correctamente por categoriaId", () => {
    const list = [
      makeExpense({ importe: 10, moneda: "EUR", mes: 1, anio: 2026, categoriaId: "A" }),
      makeExpense({ importe: 20, moneda: "EUR", mes: 1, anio: 2026, categoriaId: "B" }),
      makeExpense({ importe: 5, moneda: "EUR", mes: 1, anio: 2026, categoriaId: "A" }),
    ];
    const out = sumExpensesByCategory(list, rates, "EUR");
    expect(out["A"]).toBeCloseTo(15, 6);
    expect(out["B"]).toBeCloseTo(20, 6);
  });

  it("convierte importes a la moneda vista", () => {
    const list = [
      makeExpense({ importe: 100, moneda: "SGD", mes: 1, anio: 2026, categoriaId: "X" }),
      makeExpense({ importe: 100, moneda: "USD", mes: 1, anio: 2026, categoriaId: "X" }),
    ];
    const out = sumExpensesByCategory(list, rates, "EUR");
    expect(out["X"]).toBeCloseTo(161, 4);
  });
});

describe("sumMonthlyIncomeInView", () => {
  it("encuentra el ingreso del mes/anio y suma salario+bonus+otros", () => {
    const incomes = [
      makeMonthlyIncome({
        mes: 1,
        anio: 2026,
        salario: 5000,
        moneda: "SGD",
        bonus: 500,
        otros: 100,
      }),
    ];
    // total SGD = 5600. En EUR: 5600 * 0.69 = 3864
    expect(sumMonthlyIncomeInView(incomes, 1, 2026, rates, "EUR")).toBeCloseTo(3864, 4);
  });

  it("devuelve 0 si no hay fila para ese periodo", () => {
    expect(sumMonthlyIncomeInView([], 5, 2026, rates, "EUR")).toBe(0);
  });
});

describe("sumExtraIncomesInView", () => {
  it("suma todos los extras del mes/anio", () => {
    const extras = [
      makeExtra({ importe: 100, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExtra({ importe: 200, moneda: "EUR", mes: 1, anio: 2026 }),
      makeExtra({ importe: 999, moneda: "EUR", mes: 2, anio: 2026 }),
    ];
    expect(sumExtraIncomesInView(extras, 1, 2026, rates, "EUR")).toBe(300);
  });
});

describe("summarizeMonth", () => {
  it("calcula ingresos, gastos, ahorro y tasa coherentemente", () => {
    const expenses = [
      makeExpense({ importe: 1000, moneda: "EUR", mes: 1, anio: 2026 }),
    ];
    const monthlyIncomes = [
      makeMonthlyIncome({
        mes: 1,
        anio: 2026,
        salario: 3000,
        moneda: "EUR",
      }),
    ];
    const extraIncomes = [
      makeExtra({ importe: 500, moneda: "EUR", mes: 1, anio: 2026 }),
    ];

    const sum = summarizeMonth({
      mes: 1,
      anio: 2026,
      expenses,
      monthlyIncomes,
      extraIncomes,
      rates,
      viewCurrency: "EUR",
    });

    expect(sum.ingresos).toBe(3500);
    expect(sum.gastos).toBe(1000);
    expect(sum.ahorro).toBe(2500);
    expect(sum.tasaAhorro).toBeCloseTo(2500 / 3500, 6);
  });

  it("tasaAhorro es 0 si los ingresos son 0 (evita NaN)", () => {
    const sum = summarizeMonth({
      mes: 1,
      anio: 2026,
      expenses: [],
      monthlyIncomes: [],
      extraIncomes: [],
      rates,
      viewCurrency: "EUR",
    });
    expect(sum.tasaAhorro).toBe(0);
  });
});
