/**
 * Tests de src/lib/domain/mortgage.ts
 *
 * Los valores esperados estan calculados manualmente con la formula PMT
 * o comprobados contra Excel para asegurar coherencia con la app original.
 */

import { describe, it, expect } from "vitest";
import {
  calculateMonthlyPayment,
  buildAmortizationTable,
  summarizeMortgage,
} from "@/lib/domain/mortgage";

describe("calculateMonthlyPayment (PMT)", () => {
  it("devuelve 0 con principal cero", () => {
    expect(calculateMonthlyPayment(0, 0.03, 25)).toBe(0);
  });

  it("devuelve 0 con plazo cero", () => {
    expect(calculateMonthlyPayment(100000, 0.03, 0)).toBe(0);
  });

  it("caso degenerado: interes 0%, cuota = principal / cuotas", () => {
    // 12000 / (1*12) = 1000
    expect(calculateMonthlyPayment(12000, 0, 1)).toBeCloseTo(1000, 6);
  });

  it("hipoteca tipica espanola: 200.000 € a 25 anios al 3,2% TIN", () => {
    // Excel: =PAGO(0.032/12, 25*12, -200000) ≈ 968.91
    const cuota = calculateMonthlyPayment(200_000, 0.032, 25);
    expect(cuota).toBeCloseTo(969, 0);
  });

  it("hipoteca a 30 anios sale mas barata por cuota que a 20", () => {
    const cuota20 = calculateMonthlyPayment(200_000, 0.03, 20);
    const cuota30 = calculateMonthlyPayment(200_000, 0.03, 30);
    expect(cuota30).toBeLessThan(cuota20);
  });

  it("subir el TIN siempre incrementa la cuota", () => {
    const cuotaBaja = calculateMonthlyPayment(200_000, 0.025, 25);
    const cuotaAlta = calculateMonthlyPayment(200_000, 0.045, 25);
    expect(cuotaAlta).toBeGreaterThan(cuotaBaja);
  });

  it("prestamo personal pequeno: 5000 € a 3 anios al 8%", () => {
    // Excel: =PAGO(0.08/12, 36, -5000) ≈ 156.68
    const cuota = calculateMonthlyPayment(5_000, 0.08, 3);
    expect(cuota).toBeCloseTo(157, 0);
  });
});

describe("buildAmortizationTable", () => {
  it("devuelve array vacio con principal o plazo cero", () => {
    expect(buildAmortizationTable(0, 0.03, 25)).toEqual([]);
    expect(buildAmortizationTable(100, 0.03, 0)).toEqual([]);
  });

  it("genera tantas filas como cuotas (years * 12)", () => {
    const tabla = buildAmortizationTable(100_000, 0.03, 10);
    expect(tabla.length).toBe(120);
  });

  it("la suma de amortizaciones es igual al principal (al centimo)", () => {
    const principal = 200_000;
    const tabla = buildAmortizationTable(principal, 0.032, 25);
    const suma = tabla.reduce((acc, row) => acc + row.amortizacion, 0);
    expect(suma).toBeCloseTo(principal, 2);
  });

  it("capital pendiente decreciente y termina en 0", () => {
    const tabla = buildAmortizationTable(100_000, 0.04, 15);
    for (let i = 1; i < tabla.length; i++) {
      expect(tabla[i]!.capitalInicio).toBeLessThan(tabla[i - 1]!.capitalInicio);
    }
    expect(tabla[tabla.length - 1]!.capitalFinal).toBeCloseTo(0, 2);
  });

  it("la suma de intereses + amortizacion es siempre la cuota", () => {
    const tabla = buildAmortizationTable(100_000, 0.04, 10);
    for (const row of tabla) {
      expect(row.intereses + row.amortizacion).toBeCloseTo(row.cuota, 2);
    }
  });

  it("los intereses del primer mes son principal * TIN / 12", () => {
    const tabla = buildAmortizationTable(100_000, 0.036, 25);
    expect(tabla[0]!.intereses).toBeCloseTo((100_000 * 0.036) / 12, 6);
  });

  it("el porcentaje amortizado en la ultima cuota es 100%", () => {
    const tabla = buildAmortizationTable(50_000, 0.025, 5);
    expect(tabla[tabla.length - 1]!.pctAmortizado).toBeCloseTo(1, 4);
  });
});

describe("summarizeMortgage", () => {
  it("calcula capital prestado = precio - entrada + gastos asociados", () => {
    const s = summarizeMortgage({
      precioVivienda: 300_000,
      entrada: 60_000,
      gastosAsociados: 30_000,
      plazoAnios: 25,
      tin: 0.03,
    });
    expect(s.capitalPrestado).toBe(270_000);
  });

  it("totalIntereses = totalAPagar - capitalPrestado", () => {
    const s = summarizeMortgage({
      precioVivienda: 250_000,
      entrada: 50_000,
      gastosAsociados: 20_000,
      plazoAnios: 30,
      tin: 0.035,
    });
    expect(s.totalIntereses).toBeCloseTo(s.totalAPagar - s.capitalPrestado, 2);
  });

  it("numero de cuotas = plazo * 12", () => {
    const s = summarizeMortgage({
      precioVivienda: 200_000,
      entrada: 40_000,
      gastosAsociados: 0,
      plazoAnios: 20,
      tin: 0.03,
    });
    expect(s.numeroCuotas).toBe(240);
  });
});
