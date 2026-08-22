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
  computeUpcomingFromRule,
  currentPeriod,
  isPeriodInRange,
  lastDayOfMonth,
  occurrencesForRule,
  parseDiasDelMes,
  periodsBetween,
  type OccurrenceRule,
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

describe("parseDiasDelMes", () => {
  it("parsea lista simple", () => {
    expect(parseDiasDelMes("1,15")).toEqual([1, 15]);
  });
  it("tolera espacios", () => {
    expect(parseDiasDelMes(" 1 , 15 , 28 ")).toEqual([1, 15, 28]);
  });
  it("descarta valores fuera de 1-31 y no numericos", () => {
    expect(parseDiasDelMes("0,5,32,foo,15")).toEqual([5, 15]);
  });
  it("null/vacio -> []", () => {
    expect(parseDiasDelMes(null)).toEqual([]);
    expect(parseDiasDelMes("")).toEqual([]);
    expect(parseDiasDelMes(undefined)).toEqual([]);
  });
});

describe("occurrencesForRule", () => {
  const inicio = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)); // 01/01/2026

  const base = (over: Partial<OccurrenceRule>): OccurrenceRule => ({
    frecuencia: "mensual",
    diaDelMes: 15,
    diaSemana: null,
    diasDelMes: null,
    mesDelAnio: null,
    fechaInicio: inicio,
    fechaFin: null,
    ...over,
  });

  it("mensual: una fecha en el dia del mes", () => {
    const occ = occurrencesForRule(base({ frecuencia: "mensual", diaDelMes: 15 }), 2026, 3);
    expect(occ).toHaveLength(1);
    expect(occ[0]!.getUTCDate()).toBe(15);
    expect(occ[0]!.getUTCMonth()).toBe(2);
  });

  it("mensual: fuera de rango -> vacio", () => {
    const r = base({ frecuencia: "mensual", fechaInicio: new Date(Date.UTC(2026, 5, 1)) });
    expect(occurrencesForRule(r, 2026, 3)).toEqual([]);
  });

  it("mensual: clamp del dia 31 en febrero", () => {
    const occ = occurrencesForRule(base({ diaDelMes: 31 }), 2026, 2);
    expect(occ[0]!.getUTCDate()).toBe(28);
  });

  it("anual: solo genera en el mes configurado", () => {
    const r = base({ frecuencia: "anual", diaDelMes: 15, mesDelAnio: 3 });
    expect(occurrencesForRule(r, 2026, 3)).toHaveLength(1);
    expect(occurrencesForRule(r, 2026, 4)).toEqual([]);
    expect(occurrencesForRule(r, 2027, 3)).toHaveLength(1);
  });

  it("anual: si mesDelAnio es null, deriva del mes de fechaInicio", () => {
    const r = base({
      frecuencia: "anual",
      diaDelMes: 10,
      mesDelAnio: null,
      fechaInicio: new Date(Date.UTC(2026, 6, 10, 12)), // julio
    });
    expect(occurrencesForRule(r, 2026, 7)).toHaveLength(1);
    expect(occurrencesForRule(r, 2026, 3)).toEqual([]);
  });

  it("varios-mes: genera cada dia de la lista, ordenado", () => {
    const r = base({ frecuencia: "varios-mes", diasDelMes: "15,1,28" });
    const occ = occurrencesForRule(r, 2026, 3);
    expect(occ.map((d) => d.getUTCDate())).toEqual([1, 15, 28]);
  });

  it("varios-mes: deduplica tras clamp (30 y 31 en febrero)", () => {
    const r = base({ frecuencia: "varios-mes", diasDelMes: "30,31" });
    const occ = occurrencesForRule(r, 2026, 2);
    expect(occ.map((d) => d.getUTCDate())).toEqual([28]);
  });

  it("varios-mes: sin lista cae al diaDelMes", () => {
    const r = base({ frecuencia: "varios-mes", diasDelMes: null, diaDelMes: 10 });
    const occ = occurrencesForRule(r, 2026, 3);
    expect(occ.map((d) => d.getUTCDate())).toEqual([10]);
  });

  it("semanal: todos los lunes del mes (diaSemana=1)", () => {
    const r = base({ frecuencia: "semanal", diaSemana: 1 });
    // Marzo 2026: lunes en 2, 9, 16, 23, 30
    const occ = occurrencesForRule(r, 2026, 3);
    expect(occ.map((d) => d.getUTCDate())).toEqual([2, 9, 16, 23, 30]);
  });

  it("semanal: respeta el limite de dia de fechaInicio", () => {
    const r = base({
      frecuencia: "semanal",
      diaSemana: 1,
      fechaInicio: new Date(Date.UTC(2026, 2, 10, 12)), // 10/03/2026
    });
    // Solo lunes >= 10 de marzo: 16, 23, 30
    const occ = occurrencesForRule(r, 2026, 3);
    expect(occ.map((d) => d.getUTCDate())).toEqual([16, 23, 30]);
  });

  it("diaria: una fecha por cada dia del mes", () => {
    const r = base({ frecuencia: "diaria" });
    const occ = occurrencesForRule(r, 2026, 2); // febrero 2026 = 28 dias
    expect(occ).toHaveLength(28);
    expect(occ[0]!.getUTCDate()).toBe(1);
    expect(occ[27]!.getUTCDate()).toBe(28);
  });

  it("diaria: respeta fechaFin a nivel de dia", () => {
    const r = base({
      frecuencia: "diaria",
      fechaFin: new Date(Date.UTC(2026, 2, 5, 12)), // 05/03/2026
    });
    const occ = occurrencesForRule(r, 2026, 3);
    expect(occ.map((d) => d.getUTCDate())).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("computeUpcomingFromRule", () => {
  it("mensual: proxima ocurrencia futura dentro del horizonte", () => {
    const now = new Date(Date.UTC(2026, 2, 10, 12)); // 10/03/2026
    const rule: OccurrenceRule = {
      frecuencia: "mensual",
      diaDelMes: 20,
      diaSemana: null,
      diasDelMes: null,
      mesDelAnio: null,
      fechaInicio: new Date(Date.UTC(2026, 0, 1, 12)),
      fechaFin: null,
    };
    const up = computeUpcomingFromRule(rule, now, 30);
    expect(up.length).toBeGreaterThanOrEqual(1);
    expect(up[0]!.fecha.getUTCDate()).toBe(20);
  });

  it("semanal: varias ocurrencias futuras en 30 dias", () => {
    const now = new Date(Date.UTC(2026, 2, 1, 12)); // 01/03/2026
    const rule: OccurrenceRule = {
      frecuencia: "semanal",
      diaDelMes: 1,
      diaSemana: 1, // lunes
      diasDelMes: null,
      mesDelAnio: null,
      fechaInicio: new Date(Date.UTC(2026, 0, 1, 12)),
      fechaFin: null,
    };
    const up = computeUpcomingFromRule(rule, now, 30);
    // Lunes futuros dentro de 30 dias desde 01/03: 2,9,16,23,30
    expect(up.length).toBeGreaterThanOrEqual(4);
    expect(up.every((u) => u.fecha.getTime() > now.getTime())).toBe(true);
  });
});
