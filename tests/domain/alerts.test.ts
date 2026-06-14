/**
 * tests/domain/alerts.test.ts — avisos de presupuesto.
 */

import { describe, it, expect } from "vitest";
import { computeBudgetAlerts, type BudgetInput } from "@/lib/domain/alerts";

const row = (
  categoriaId: string,
  nombre: string,
  gastado: number,
  presupuesto: number,
): BudgetInput => ({ categoriaId, nombre, gastado, presupuesto });

describe("computeBudgetAlerts", () => {
  it("avisa de pasado (high) y casi (warn); ignora dentro y sin presupuesto", () => {
    const rows = [
      row("a", "Restaurantes", 120, 100), // pasado -> high (ratio 1.2)
      row("b", "Super", 85, 100), // casi -> warn (ratio 0.85)
      row("c", "Ocio", 40, 100), // dentro -> nada
      row("d", "Sin presu", 50, 0), // sin presupuesto -> nada
    ];
    const alerts = computeBudgetAlerts(rows);
    expect(alerts.map((a) => a.categoriaId)).toEqual(["a", "b"]);
    expect(alerts[0]?.severity).toBe("high");
    expect(alerts[1]?.severity).toBe("warn");
  });

  it("ordena de mayor a menor exceso (los mas pasados primero)", () => {
    const rows = [
      row("a", "A", 110, 100), // 1.1
      row("b", "B", 200, 100), // 2.0
      row("c", "C", 90, 100), // 0.9 warn
    ];
    expect(computeBudgetAlerts(rows).map((a) => a.categoriaId)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("umbral 'cerca' configurable", () => {
    const rows = [row("a", "A", 70, 100)]; // 0.7
    expect(computeBudgetAlerts(rows)).toHaveLength(0); // default 0.8
    expect(computeBudgetAlerts(rows, 0.6)).toHaveLength(1); // umbral 0.6
  });

  it("justo en el limite (ratio 1) es warn, no high", () => {
    const alerts = computeBudgetAlerts([row("a", "A", 100, 100)]);
    expect(alerts[0]?.severity).toBe("warn");
  });

  it("sin filas -> sin avisos", () => {
    expect(computeBudgetAlerts([])).toEqual([]);
  });
});
