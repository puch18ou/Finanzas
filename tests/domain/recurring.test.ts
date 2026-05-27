/**
 * tests/domain/recurring.test.ts
 *
 * Tests de las utilidades puras de fechas.
 */

import { describe, it, expect } from "vitest";
import {
  anioMesToComparableNumber,
  buildPeriodDate,
  clampDayToMonth,
  currentPeriod,
  isPeriodInRange,
  lastDayOfMonth,
  periodsBetween,
} from "@/lib/domain/recurring";

describe("lastDayOfMonth", () => {
  it("enero tiene 31 dias", () => {
    expect(lastDayOfMonth(2026, 1)).toBe(31);
  });
  it("febrero 2026 (no bisiesto) tiene 28 dias", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
  });
  it("febrero 2024 (bisiesto) tiene 29 dias", () => {
    expect(lastDayOfMonth(2024, 2)).toBe(29);
  });
  it("febrero 2028 (bisiesto) tiene 29 dias", () => {
    expect(lastDayOfMonth(2028, 2)).toBe(29);
  });
  it("abril tiene 30 dias", () => {
    expect(lastDayOfMonth(2026, 4)).toBe(30);
  });
  it("diciembre tiene 31 dias", () => {
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
});

describe("clampDayToMonth", () => {
  it("dia 15 en febrero queda igual", () => {
    expect(clampDayToMonth(15, 2026, 2)).toBe(15);
  });
  it("dia 31 en febrero 2026 se vuelve 28", () => {
    expect(clampDayToMonth(31, 2026, 2)).toBe(28);
  });
  it("dia 31 en febrero 2024 (bisiesto) se vuelve 29", () => {
    expect(clampDayToMonth(31, 2024, 2)).toBe(29);
  });
  it("dia 31 en abril (30 dias) se vuelve 30", () => {
    expect(clampDayToMonth(31, 2026, 4)).toBe(30);
  });
  it("dia 1 nunca se modifica", () => {
    expect(clampDayToMonth(1, 2026, 2)).toBe(1);
  });
});

describe("buildPeriodDate", () => {
  it("crea fecha 15/03/2026 con UTC noon", () => {
    const d = buildPeriodDate(15, 2026, 3);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(12);
  });
  it("hace clamp del dia 31 en febrero", () => {
    const d = buildPeriodDate(31, 2026, 2);
    expect(d.getUTCDate()).toBe(28);
  });
  it("dia 31 en abril -> 30", () => {
    const d = buildPeriodDate(31, 2026, 4);
    expect(d.getUTCDate()).toBe(30);
  });
});

describe("anioMesToComparableNumber", () => {
  it("(2026, 5) = 202605", () => {
    expect(anioMesToComparableNumber(2026, 5)).toBe(202605);
  });
  it("ordena correctamente", () => {
    const a = anioMesToComparableNumber(2025, 12);
    const b = anioMesToComparableNumber(2026, 1);
    expect(a).toBeLessThan(b);
  });
});

describe("isPeriodInRange", () => {
  const inicio = new Date(Date.UTC(2026, 2, 15, 12, 0, 0)); // 15/03/2026

  it("periodo igual al mes de inicio: incluido", () => {
    expect(isPeriodInRange(2026, 3, inicio, null)).toBe(true);
  });
  it("periodo anterior al mes de inicio: excluido", () => {
    expect(isPeriodInRange(2026, 2, inicio, null)).toBe(false);
  });
  it("periodo posterior al mes de inicio (sin fin): incluido", () => {
    expect(isPeriodInRange(2026, 5, inicio, null)).toBe(true);
  });
  it("con fechaFin: periodo dentro del rango", () => {
    const fin = new Date(Date.UTC(2026, 5, 30)); // 30/06/2026
    expect(isPeriodInRange(2026, 4, inicio, fin)).toBe(true);
    expect(isPeriodInRange(2026, 6, inicio, fin)).toBe(true); // mes igual a fin
    expect(isPeriodInRange(2026, 7, inicio, fin)).toBe(false);
  });
});

describe("periodsBetween", () => {
  it("rango de un solo mes", () => {
    const r = periodsBetween(2026, 5, 2026, 5);
    expect(r).toEqual([{ anio: 2026, mes: 5 }]);
  });
  it("rango de varios meses dentro del mismo año", () => {
    const r = periodsBetween(2026, 3, 2026, 6);
    expect(r).toEqual([
      { anio: 2026, mes: 3 },
      { anio: 2026, mes: 4 },
      { anio: 2026, mes: 5 },
      { anio: 2026, mes: 6 },
    ]);
  });
  it("rango cruzando un cambio de año", () => {
    const r = periodsBetween(2025, 11, 2026, 2);
    expect(r).toEqual([
      { anio: 2025, mes: 11 },
      { anio: 2025, mes: 12 },
      { anio: 2026, mes: 1 },
      { anio: 2026, mes: 2 },
    ]);
  });
  it("rango invertido (final < inicio): array vacio", () => {
    const r = periodsBetween(2026, 6, 2026, 3);
    expect(r).toEqual([]);
  });
});

describe("currentPeriod", () => {
  it("devuelve anio/mes del Date inyectado", () => {
    const d = new Date(2026, 4, 15); // 15 mayo 2026 local time
    expect(currentPeriod(d)).toEqual({ anio: 2026, mes: 5 });
  });
});
