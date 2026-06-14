/**
 * tests/services/backup-rollback.test.ts
 *
 * Verifica la "transaccion a nivel de aplicacion" de BackupService.importAll:
 *   - import correcto -> reemplaza todos los datos.
 *   - import que falla a mitad -> REVIERTE al estado anterior (no se pierde
 *     nada), que es justo el fallo que dejaba la BD a medio vaciar.
 *
 * Usa una BD falsa en memoria que imita el subconjunto de la API de Drizzle
 * que usa BackupService (select().from(t), delete(t), insert(t).values(row)).
 */

import { describe, it, expect } from "vitest";
import { BackupService, type BackupFile } from "@/lib/services/backup-service";
import {
  currencies,
  settings,
  categories,
  accounts,
  investments,
  investmentContributions,
  goals,
  mortgage,
  otherDebts,
  movements,
  recurringRules,
  objetivoAhorroTramos,
  presupuestoTramos,
} from "@/lib/db/schema";
import type { DrizzleDb } from "@/lib/db/proxy-driver";

// Una fila "envenenada" hace fallar su INSERT (simula un dato que rompe a
// mitad de la restauracion).
const POISON = "__poison__";

/** BD falsa: guarda filas por tabla (identidad de objeto) e imita Drizzle. */
class FakeDb {
  tables = new Map<object, Record<string, unknown>[]>();

  private rowsOf(t: object): Record<string, unknown>[] {
    let r = this.tables.get(t);
    if (!r) {
      r = [];
      this.tables.set(t, r);
    }
    return r;
  }

  seed(t: object, rows: Record<string, unknown>[]) {
    this.tables.set(t, [...rows]);
  }

  rows(t: object): Record<string, unknown>[] {
    return this.rowsOf(t);
  }

  select() {
    return {
      from: (t: object) => Promise.resolve([...this.rowsOf(t)]),
    };
  }

  delete(t: object) {
    this.rowsOf(t).length = 0;
    return Promise.resolve();
  }

  insert(t: object) {
    return {
      values: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const arr = Array.isArray(row) ? row : [row];
        if (arr.some((r) => r && r[POISON])) {
          return Promise.reject(new Error("fila envenenada (test)"));
        }
        this.rowsOf(t).push(...arr);
        return Promise.resolve();
      },
    };
  }
}

const EMPTY_TABLES = [
  investments,
  investmentContributions,
  goals,
  mortgage,
  otherDebts,
  recurringRules,
  objetivoAhorroTramos,
  presupuestoTramos,
] as const;

/** Construye un backup v7 valido con las cuentas/monedas/movimientos dados. */
function makeBackup(opts: {
  currencies: Record<string, unknown>[];
  accounts: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  movements?: Record<string, unknown>[];
}): BackupFile {
  return {
    version: 7,
    exportedAt: "2026-06-14T00:00:00.000Z",
    app: "finanzas",
    data: {
      currencies: opts.currencies,
      settings: [],
      categories: opts.categories ?? [],
      accounts: opts.accounts,
      investments: [],
      investmentContributions: [],
      goals: [],
      mortgage: [],
      otherDebts: [],
      movements: opts.movements ?? [],
      recurringRules: [],
      objetivoAhorroTramos: [],
      presupuestoTramos: [],
    },
  };
}

/** Siembra la BD falsa con un estado inicial conocido (S0). */
function seedInitial(db: FakeDb) {
  db.seed(currencies, [{ code: "EUR", nombre: "Euro" }]);
  db.seed(accounts, [{ id: "a1", alias: "Banco viejo", moneda: "EUR" }]);
  db.seed(movements, [{ id: "m1", concepto: "gasto viejo", moneda: "EUR" }]);
  for (const t of EMPTY_TABLES) db.seed(t, []);
  db.seed(settings, []);
  db.seed(categories, []);
}

describe("BackupService.importAll — transaccion a nivel de app", () => {
  it("import correcto reemplaza todos los datos", async () => {
    const db = new FakeDb();
    seedInitial(db);
    const svc = new BackupService(db as unknown as DrizzleDb);

    await svc.importAll(
      makeBackup({
        currencies: [{ code: "EUR", nombre: "Euro" }],
        accounts: [{ id: "a2", alias: "Banco nuevo", moneda: "EUR" }],
        movements: [{ id: "m2", concepto: "gasto nuevo", moneda: "EUR" }],
      }),
    );

    expect(db.rows(accounts).map((r) => r.id)).toEqual(["a2"]);
    expect(db.rows(movements).map((r) => r.id)).toEqual(["m2"]);
  });

  it("si el import falla a mitad, REVIERTE al estado anterior", async () => {
    const db = new FakeDb();
    seedInitial(db);
    const svc = new BackupService(db as unknown as DrizzleDb);

    // El backup nuevo trae un movimiento envenenado: su INSERT fallara DESPUES
    // de haber borrado todo y de insertar cuentas/monedas nuevas.
    const bad = makeBackup({
      currencies: [{ code: "EUR", nombre: "Euro" }],
      accounts: [{ id: "aX", alias: "Banco intruso", moneda: "EUR" }],
      movements: [{ id: "mX", concepto: "veneno", moneda: "EUR", [POISON]: true }],
    });

    await expect(svc.importAll(bad)).rejects.toThrow(/revirtio al estado anterior/i);

    // La BD quedo EXACTAMENTE como estaba (S0), no a medio vaciar.
    expect(db.rows(accounts).map((r) => r.id)).toEqual(["a1"]);
    expect(db.rows(movements).map((r) => r.id)).toEqual(["m1"]);
    expect(db.rows(currencies).map((r) => r.code)).toEqual(["EUR"]);
  });
});
