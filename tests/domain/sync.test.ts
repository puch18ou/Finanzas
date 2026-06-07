/**
 * Tests de sync.ts — motor de fusion LWW para sincronizacion P2P.
 */

import { describe, it, expect } from "vitest";
import {
  toMillis,
  compareVersions,
  mergeRecord,
  mergeTable,
  collectChanges,
  mergeTombstones,
  idsKilledByTombstones,
  SYNC_TABLE_ORDER,
  type MergeContext,
  type Tombstone,
} from "@/lib/domain/sync";

type Row = { id: string; updatedAt: number; v?: string };

const r = (id: string, updatedAt: number, v?: string): Row => ({
  id,
  updatedAt,
  v,
});

// Contextos: L < R lexicograficamente.
const ctxL: MergeContext = { localDeviceId: "A", remoteDeviceId: "B" };
const ctxR: MergeContext = { localDeviceId: "B", remoteDeviceId: "A" };

describe("toMillis", () => {
  it("acepta number y Date", () => {
    expect(toMillis(123)).toBe(123);
    expect(toMillis(new Date(123))).toBe(123);
  });
});

describe("compareVersions", () => {
  it("gana el updatedAt mayor", () => {
    expect(compareVersions(r("x", 200), r("x", 100), ctxL)).toBe("local");
    expect(compareVersions(r("x", 100), r("x", 200), ctxL)).toBe("remote");
  });

  it("empate de tiempo: desempata el deviceId, deterministico en ambos pares", () => {
    // En el dispositivo A (local=A, remote=B): gana B (id mayor) => remote.
    expect(compareVersions(r("x", 100), r("x", 100), ctxL)).toBe("remote");
    // En el dispositivo B (local=B, remote=A): gana B => local.
    expect(compareVersions(r("x", 100), r("x", 100), ctxR)).toBe("local");
    // Ambos eligen la fila de B: consistente.
  });

  it("mismo device y mismo tiempo => equal", () => {
    const ctx = { localDeviceId: "A", remoteDeviceId: "A" };
    expect(compareVersions(r("x", 100), r("x", 100), ctx)).toBe("equal");
  });
});

describe("mergeRecord", () => {
  it("devuelve la version remota cuando gana", () => {
    expect(mergeRecord(r("x", 1, "old"), r("x", 2, "new"), ctxL).v).toBe("new");
  });
  it("conserva la local cuando gana", () => {
    expect(mergeRecord(r("x", 3, "keep"), r("x", 2, "old"), ctxL).v).toBe(
      "keep",
    );
  });
});

describe("mergeTable", () => {
  it("anade filas remotas nuevas", () => {
    const res = mergeTable([r("a", 1)], [r("b", 1)], ctxL);
    expect(res.merged.map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(res.toApplyLocally.map((x) => x.id)).toEqual(["b"]);
  });

  it("conserva locales sin contrapartida remota", () => {
    const res = mergeTable([r("a", 5, "mine")], [], ctxL);
    expect(res.merged).toHaveLength(1);
    expect(res.toApplyLocally).toHaveLength(0);
  });

  it("LWW por id: remota mas nueva sobrescribe", () => {
    const res = mergeTable([r("a", 1, "old")], [r("a", 2, "new")], ctxL);
    expect(res.merged[0]?.v).toBe("new");
    expect(res.toApplyLocally).toHaveLength(1);
  });

  it("LWW por id: local mas nueva no se toca", () => {
    const res = mergeTable([r("a", 9, "mine")], [r("a", 2, "old")], ctxL);
    expect(res.merged[0]?.v).toBe("mine");
    expect(res.toApplyLocally).toHaveLength(0);
  });

  it("keyOf: agrupa por clave distinta de id (currencies usa code)", () => {
    // Filas SIN id (como currencies): clave = code. Sin keyOf colapsarian.
    const locals: never[] = [];
    const remotes = [
      { code: "EUR", updatedAt: 100 },
      { code: "SGD", updatedAt: 100 },
      { code: "USD", updatedAt: 100 },
    ] as unknown as Row[];
    const res = mergeTable(locals, remotes, ctxL, (r) =>
      String((r as unknown as { code: string }).code),
    );
    // Las 3 sobreviven (no colapsan en una sola clave undefined).
    expect(res.merged).toHaveLength(3);
    expect(res.toApplyLocally).toHaveLength(3);
  });

  it("un tombstone remoto mas nuevo gana (borrado se propaga)", () => {
    const local = { id: "a", updatedAt: 1, deletedAt: null as number | null };
    const remote = { id: "a", updatedAt: 5, deletedAt: 5 as number | null };
    const res = mergeTable([local], [remote], ctxL);
    expect(res.merged[0]?.deletedAt).toBe(5);
    expect(res.toApplyLocally).toHaveLength(1);
  });
});

describe("collectChanges", () => {
  it("solo filas estrictamente posteriores al cursor", () => {
    const rows = [r("a", 10), r("b", 20), r("c", 30)];
    const res = collectChanges(rows, 15);
    expect(res.changes.map((x) => x.id).sort()).toEqual(["b", "c"]);
    expect(res.cursor).toBe(30);
  });

  it("sin cambios deja el cursor igual", () => {
    const res = collectChanges([r("a", 5)], 10);
    expect(res.changes).toHaveLength(0);
    expect(res.cursor).toBe(10);
  });

  it("cursor = mayor updatedAt enviado", () => {
    const res = collectChanges([r("a", 100), r("b", 50)], 0);
    expect(res.cursor).toBe(100);
  });
});

describe("tombstones", () => {
  const tomb = (id: string, updatedAt: number, tabla = "movements"): Tombstone => ({
    id,
    tabla,
    updatedAt,
  });

  it("idsKilledByTombstones: mata la fila si la lapida es mas nueva", () => {
    const rows = [r("a", 5), r("b", 10)];
    const tombs = [tomb("a", 8), tomb("b", 3)];
    // 'a' tiene lapida (8) > su updatedAt (5) => muere.
    // 'b' se edito (10) despues de su lapida (3) => sobrevive.
    expect(idsKilledByTombstones(rows, tombs)).toEqual(["a"]);
  });

  it("idsKilledByTombstones: sin lapida no mata", () => {
    expect(idsKilledByTombstones([r("a", 5)], [])).toEqual([]);
  });

  it("idsKilledByTombstones: empate exacto no mata (no es estrictamente posterior)", () => {
    expect(idsKilledByTombstones([r("a", 5)], [tomb("a", 5)])).toEqual([]);
  });

  it("mergeTombstones: LWW por id como cualquier tabla", () => {
    const res = mergeTombstones([tomb("a", 1)], [tomb("a", 5), tomb("b", 2)], ctxL);
    expect(res.toApplyLocally.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(res.merged.find((t) => t.id === "a")?.updatedAt).toBe(5);
  });
});

describe("SYNC_TABLE_ORDER", () => {
  it("respeta dependencias FK clave", () => {
    const idx = (t: string) => SYNC_TABLE_ORDER.indexOf(t as never);
    // currencies antes que todo lo que la referencia
    expect(idx("currencies")).toBeLessThan(idx("accounts"));
    expect(idx("currencies")).toBeLessThan(idx("settings"));
    // movements antes que las aportaciones (que lo referencian)
    expect(idx("movements")).toBeLessThan(idx("investment_contributions"));
    // categories/accounts antes que movements
    expect(idx("categories")).toBeLessThan(idx("movements"));
    expect(idx("accounts")).toBeLessThan(idx("movements"));
    // investments antes que sus aportaciones
    expect(idx("investments")).toBeLessThan(idx("investment_contributions"));
    // categories antes que sus tramos de presupuesto
    expect(idx("categories")).toBeLessThan(idx("presupuesto_tramos"));
  });

  it("no incluye sync_log (plomeria local, no se sincroniza)", () => {
    expect(SYNC_TABLE_ORDER).not.toContain("sync_log");
  });
});
