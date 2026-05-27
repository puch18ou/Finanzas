/**
 * Tests de projection.ts y goals.ts
 */

import { describe, it, expect } from "vitest";
import { projectPatrimony } from "@/lib/domain/projection";
import {
  calculateGoalProgress,
  monthsBetween,
} from "@/lib/domain/goals";
import type { Goal } from "@/lib/db/schema";

describe("projectPatrimony", () => {
  it("anio 0 = patrimonio inicial", () => {
    const rows = projectPatrimony(10_000, 5_000, 0.05, 0.025, 10);
    expect(rows[0]!.patrimonioNominal).toBe(10_000);
    expect(rows[0]!.patrimonioReal).toBe(10_000);
  });

  it("genera anios + 1 filas", () => {
    const rows = projectPatrimony(0, 1000, 0.05, 0.02, 10);
    expect(rows.length).toBe(11);
  });

  it("patrimonio nominal crece con ahorro y rentabilidad", () => {
    // Anio 1: (0 + 1000) * 1.05 = 1050
    // Anio 2: (1050 + 1000) * 1.05 = 2152.5
    const rows = projectPatrimony(0, 1000, 0.05, 0, 2);
    expect(rows[1]!.patrimonioNominal).toBeCloseTo(1050, 6);
    expect(rows[2]!.patrimonioNominal).toBeCloseTo(2152.5, 4);
  });

  it("con rentabilidad cero el patrimonio crece solo por ahorro", () => {
    // 5 anios * 1000 = 5000
    const rows = projectPatrimony(0, 1000, 0, 0, 5);
    expect(rows[5]!.patrimonioNominal).toBeCloseTo(5000, 6);
  });

  it("patrimonio real < nominal con inflacion positiva", () => {
    const rows = projectPatrimony(10_000, 0, 0, 0.02, 10);
    expect(rows[10]!.patrimonioReal).toBeLessThan(rows[10]!.patrimonioNominal);
  });

  it("patrimonio real = nominal con inflacion 0", () => {
    const rows = projectPatrimony(10_000, 100, 0.05, 0, 10);
    for (const r of rows) {
      expect(r.patrimonioReal).toBeCloseTo(r.patrimonioNominal, 6);
    }
  });
});

describe("monthsBetween", () => {
  it("calcula meses completos entre dos fechas mismo dia", () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 5, 15))).toBe(5);
  });

  it("resta 1 si el dia destino es anterior al origen", () => {
    expect(monthsBetween(new Date(2026, 0, 20), new Date(2026, 5, 15))).toBe(4);
  });

  it("maneja fechas en pasado (numero negativo)", () => {
    expect(monthsBetween(new Date(2026, 5, 1), new Date(2026, 0, 1))).toBe(-5);
  });
});

describe("calculateGoalProgress", () => {
  const baseGoal: Goal = {
    id: "g1",
    nombre: "Entrada piso",
    importeObjetivo: 50_000,
    yaAhorrado: 10_000,
    moneda: "EUR",
    fechaObjetivo: new Date(2030, 0, 1),
    cuentaVinculadaId: null,
    notas: null,
    completada: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it("calcula progreso correcto (yaAhorrado / objetivo)", () => {
    const p = calculateGoalProgress(baseGoal, new Date(2026, 0, 1));
    expect(p.progreso).toBeCloseTo(0.2, 6);
    expect(p.restante).toBe(40_000);
    expect(p.completada).toBe(false);
  });

  it("clampea progreso a 1 si ya excedido", () => {
    const goal = { ...baseGoal, yaAhorrado: 60_000 };
    const p = calculateGoalProgress(goal, new Date(2026, 0, 1));
    expect(p.progreso).toBe(1);
    expect(p.restante).toBe(0);
    expect(p.completada).toBe(true);
  });

  it("calcula ahorro mensual necesario en base a meses restantes", () => {
    // 48 meses (4 anios) restantes, 40000 por ahorrar → 833.33/mes
    const p = calculateGoalProgress(baseGoal, new Date(2026, 0, 1));
    expect(p.mesesRestantes).toBe(48);
    expect(p.ahorroMensualNecesario).toBeCloseTo(40_000 / 48, 4);
  });

  it("marca vencida si la fecha paso y no esta completa", () => {
    const goal = { ...baseGoal, fechaObjetivo: new Date(2025, 0, 1) };
    const p = calculateGoalProgress(goal, new Date(2026, 0, 1));
    expect(p.vencida).toBe(true);
    expect(p.ahorroMensualNecesario).toBe(0);
  });

  it("no marca vencida si esta completada aunque la fecha pasara", () => {
    const goal = {
      ...baseGoal,
      yaAhorrado: 50_000,
      fechaObjetivo: new Date(2025, 0, 1),
    };
    const p = calculateGoalProgress(goal, new Date(2026, 0, 1));
    expect(p.vencida).toBe(false);
    expect(p.completada).toBe(true);
  });
});
