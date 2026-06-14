/**
 * tests/domain/cashflow.test.ts — prevision de liquidez.
 */

import { describe, it, expect } from "vitest";
import {
  projectCashflow,
  saldoAtDate,
  type CashflowEvent,
} from "@/lib/domain/cashflow";

const d = (iso: string) => new Date(iso);

const eventos: CashflowEvent[] = [
  { fecha: d("2026-06-25"), delta: 2000, label: "Nomina" }, // ingreso
  { fecha: d("2026-06-28"), delta: -1500, label: "Alquiler" }, // gasto
  { fecha: d("2026-07-01"), delta: -300, label: "Suscripciones" },
];

describe("projectCashflow", () => {
  it("aplica los eventos en orden y calcula saldo final", () => {
    const r = projectCashflow(1000, eventos);
    expect(r.puntos.map((p) => p.saldo)).toEqual([3000, 1500, 1200]);
    expect(r.saldoFinal).toBe(1200);
  });

  it("ordena por fecha aunque lleguen desordenados", () => {
    const r = projectCashflow(1000, [eventos[2]!, eventos[0]!, eventos[1]!]);
    expect(r.puntos.map((p) => p.label)).toEqual([
      "Nomina",
      "Alquiler",
      "Suscripciones",
    ]);
  });

  it("detecta el minimo y su fecha", () => {
    // Empieza en 100; baja a -200 el dia 5, luego sube.
    const r = projectCashflow(100, [
      { fecha: d("2026-06-05"), delta: -300, label: "Gasto" },
      { fecha: d("2026-06-20"), delta: 500, label: "Ingreso" },
    ]);
    expect(r.minSaldo).toBe(-200);
    expect(r.minFecha).toEqual(d("2026-06-05"));
  });

  it("si nunca baja del inicial, minFecha es null", () => {
    const r = projectCashflow(1000, [
      { fecha: d("2026-06-10"), delta: 200, label: "Ingreso" },
    ]);
    expect(r.minSaldo).toBe(1000);
    expect(r.minFecha).toBe(null);
  });

  it("sin eventos: saldo final = inicial", () => {
    const r = projectCashflow(500, []);
    expect(r.saldoFinal).toBe(500);
    expect(r.puntos).toHaveLength(0);
  });
});

describe("saldoAtDate", () => {
  it("suma solo los deltas hasta la fecha limite (incluida)", () => {
    // Hasta fin de junio: 1000 + 2000 - 1500 = 1500 (la suscripcion es julio).
    expect(saldoAtDate(1000, eventos, d("2026-06-30"))).toBe(1500);
  });
  it("hasta una fecha posterior incluye todo", () => {
    expect(saldoAtDate(1000, eventos, d("2026-07-31"))).toBe(1200);
  });
});
