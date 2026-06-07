/**
 * Tests de sync-session.ts — convergencia de una ronda de sync P2P.
 *
 * Usa un SyncStore en memoria para dos "dispositivos" (A y B) y comprueba que
 * tras `bidirectionalSync` ambos quedan con el MISMO estado, en varios
 * escenarios: alta, edicion concurrente (LWW), borrado por lapida, y edicion
 * posterior al borrado (resucita).
 */

import { describe, it, expect } from "vitest";
import {
  SyncSession,
  bidirectionalSync,
  requestToWire,
  type SyncRow,
  type SyncStore,
  type ExchangeRequest,
  type ExchangeResponse,
} from "@/lib/domain/sync-session";
import { type SyncTable, type Tombstone, SYNC_TABLE_ORDER } from "@/lib/domain/sync";

/** SyncStore en memoria para un dispositivo de prueba. */
class MemStore implements SyncStore {
  private tables = new Map<string, Map<string, SyncRow>>();
  private tombs = new Map<string, Tombstone>();
  private cursors = new Map<string, number>();

  constructor(private deviceId: string) {
    for (const t of SYNC_TABLE_ORDER) this.tables.set(t, new Map());
  }

  getDeviceId() {
    return this.deviceId;
  }

  private pushCursors = new Map<string, number>();

  async getPullCursor(peer: string) {
    return this.cursors.get(peer) ?? 0;
  }
  async setPullCursor(peer: string, ms: number) {
    this.cursors.set(peer, ms);
  }
  async getPushCursor(peer: string) {
    return this.pushCursors.get(peer) ?? 0;
  }
  async setPushCursor(peer: string, ms: number) {
    this.pushCursors.set(peer, ms);
  }

  async getRows(table: SyncTable) {
    return [...this.tables.get(table)!.values()];
  }
  async applyRows(table: SyncTable, rows: SyncRow[]) {
    const m = this.tables.get(table)!;
    for (const r of rows) m.set(r.id, r);
  }
  async deleteRows(table: SyncTable, ids: string[]) {
    const m = this.tables.get(table)!;
    for (const id of ids) m.delete(id);
  }

  async getTombstones() {
    return [...this.tombs.values()];
  }
  async applyTombstones(ts: Tombstone[]) {
    for (const t of ts) this.tombs.set(t.id, t);
  }

  // Helpers de test (mutaciones "locales", como las haria la app).
  put(table: SyncTable, row: SyncRow) {
    this.tables.get(table)!.set(row.id, row);
  }
  purge(table: SyncTable, id: string, deletedAt: number) {
    this.tables.get(table)!.delete(id);
    this.tombs.set(id, { id, tabla: table, updatedAt: deletedAt });
  }
  snapshot(table: SyncTable) {
    return [...this.tables.get(table)!.values()]
      .map((r) => ({ id: r.id, updatedAt: r.updatedAt, v: r.v }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

const A_ID = "device-A";
const B_ID = "device-B";

function pair() {
  const a = new MemStore(A_ID);
  const b = new MemStore(B_ID);
  const sa = { session: new SyncSession(a), deviceId: A_ID };
  const sb = { session: new SyncSession(b), deviceId: B_ID };
  return { a, b, sa, sb };
}

const row = (id: string, updatedAt: number, v?: string): SyncRow => ({
  id,
  updatedAt,
  ...(v !== undefined ? { v } : {}),
});

describe("bidirectionalSync — convergencia", () => {
  it("un alta en A aparece en B", async () => {
    const { a, b, sa, sb } = pair();
    a.put("accounts", row("acc1", 100, "Cuenta"));

    await bidirectionalSync(sa, sb);

    expect(b.snapshot("accounts")).toEqual(a.snapshot("accounts"));
    expect(b.snapshot("accounts")).toHaveLength(1);
  });

  it("altas en ambos lados se mezclan (cada uno ve las dos)", async () => {
    const { a, b, sa, sb } = pair();
    a.put("categories", row("ca", 100, "A"));
    b.put("categories", row("cb", 100, "B"));

    await bidirectionalSync(sa, sb);

    expect(a.snapshot("categories")).toEqual(b.snapshot("categories"));
    expect(a.snapshot("categories")).toHaveLength(2);
  });

  it("edicion concurrente: gana el updatedAt mayor (LWW)", async () => {
    const { a, b, sa, sb } = pair();
    a.put("categories", row("c1", 100, "vieja"));
    b.put("categories", row("c1", 200, "nueva"));

    await bidirectionalSync(sa, sb);

    expect(a.snapshot("categories")).toEqual(b.snapshot("categories"));
    expect(a.snapshot("categories")[0]?.v).toBe("nueva");
  });

  it("un borrado (lapida) en A se propaga y elimina la fila en B", async () => {
    const { a, b, sa, sb } = pair();
    // Primero existe en ambos.
    a.put("movements", row("m1", 100, "gasto"));
    await bidirectionalSync(sa, sb);
    expect(b.snapshot("movements")).toHaveLength(1);

    // A lo purga (vaciar papelera) en t=300.
    a.purge("movements", "m1", 300);
    await bidirectionalSync(sa, sb);

    expect(a.snapshot("movements")).toHaveLength(0);
    expect(b.snapshot("movements")).toHaveLength(0);
  });

  it("edicion posterior al borrado gana al delete (resucita)", async () => {
    const { a, b, sa, sb } = pair();
    a.put("goals", row("g1", 100, "meta"));
    await bidirectionalSync(sa, sb);

    // A purga en t=200; B edita la misma fila en t=300 (mas tarde).
    a.purge("goals", "g1", 200);
    b.put("goals", row("g1", 300, "meta-editada"));

    await bidirectionalSync(sa, sb);

    // La edicion mas nueva gana: la fila sobrevive en ambos.
    expect(a.snapshot("goals")).toEqual(b.snapshot("goals"));
    expect(a.snapshot("goals")).toHaveLength(1);
    expect(a.snapshot("goals")[0]?.v).toBe("meta-editada");
  });

  it("es idempotente: sincronizar de nuevo sin cambios no aplica nada", async () => {
    const { a, b, sa, sb } = pair();
    a.put("accounts", row("acc1", 100, "X"));
    await bidirectionalSync(sa, sb);

    const second = await bidirectionalSync(sa, sb);
    expect(second.a.appliedRows).toBe(0);
    expect(second.b.appliedRows).toBe(0);
    expect(second.a.deletedRows).toBe(0);
    expect(second.b.deletedRows).toBe(0);
  });

  it("convergencia en multiples tablas a la vez", async () => {
    const { a, b, sa, sb } = pair();
    a.put("currencies", row("EUR", 50, "Euro"));
    a.put("accounts", row("acc1", 60, "Cuenta"));
    a.put("movements", row("m1", 70, "gasto"));
    b.put("categories", row("c1", 80, "Cat"));

    await bidirectionalSync(sa, sb);

    for (const t of ["currencies", "accounts", "movements", "categories"] as const) {
      expect(a.snapshot(t)).toEqual(b.snapshot(t));
    }
  });
});

describe("intercambio cliente/servidor (exchange)", () => {
  // Simula el transporte (fichero o red) llevando la peticion del CLIENTE al
  // SERVIDOR, serializando por el camino (Date -> ms via requestToWire + JSON).
  function makeTransport(server: SyncSession) {
    return async (req: ExchangeRequest): Promise<ExchangeResponse> => {
      const wire = JSON.parse(JSON.stringify(requestToWire(req))) as ExchangeRequest;
      const resp = await server.handleExchange(wire);
      return JSON.parse(JSON.stringify(resp)) as ExchangeResponse;
    };
  }

  it("cliente (movil) y servidor (PC) convergen en un intercambio", async () => {
    const { a: pc, b: phone, sa: pcS, sb: phoneS } = pair();
    pc.put("accounts", row("acc1", 100, "Cuenta PC"));
    phone.put("movements", row("m1", 110, "gasto movil"));

    // El movil (cliente) intercambia con el PC (servidor).
    await phoneS.session.exchangeWith(pcS.deviceId, makeTransport(pcS.session));

    expect(phone.snapshot("accounts")).toEqual(pc.snapshot("accounts"));
    expect(pc.snapshot("movements")).toEqual(phone.snapshot("movements"));
  });

  it("un segundo intercambio sin cambios no aplica nada (cursores avanzan)", async () => {
    const { sa: pcS, sb: phoneS, a: pc } = pair();
    pc.put("accounts", row("acc1", 100, "X"));

    await phoneS.session.exchangeWith(pcS.deviceId, makeTransport(pcS.session));
    const second = await phoneS.session.exchangeWith(
      pcS.deviceId,
      makeTransport(pcS.session),
    );
    expect(second.appliedRows).toBe(0);
    expect(second.deletedRows).toBe(0);
  });

  it("un borrado en el PC se propaga al movil por intercambio", async () => {
    const { a: pc, b: phone, sa: pcS, sb: phoneS } = pair();
    pc.put("goals", row("g1", 100, "meta"));
    await phoneS.session.exchangeWith(pcS.deviceId, makeTransport(pcS.session));
    expect(phone.snapshot("goals")).toHaveLength(1);

    pc.purge("goals", "g1", 300);
    await phoneS.session.exchangeWith(pcS.deviceId, makeTransport(pcS.session));
    expect(phone.snapshot("goals")).toHaveLength(0);
  });
});
