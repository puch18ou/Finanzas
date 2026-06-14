/**
 * tests/helpers/mem-sync-store.ts
 *
 * SyncStore EN MEMORIA para tests de sincronizacion: replica el contrato que la
 * app implementa de verdad con DbSyncStore (sobre Drizzle/SQLite), pero sin
 * Tauri. Permite montar varios "dispositivos" y sincronizarlos.
 *
 * Las tablas se indexan por `id` (igual que el store real para todas las tablas
 * salvo currencies, que usa `code`; eso se cubre aparte en sync.test.ts a nivel
 * de mergeTable con keyOf).
 */

import {
  SyncSession,
  type SyncRow,
  type SyncStore,
} from "@/lib/domain/sync-session";
import { type SyncTable, type Tombstone, SYNC_TABLE_ORDER } from "@/lib/domain/sync";

export class MemStore implements SyncStore {
  private tables = new Map<string, Map<string, SyncRow>>();
  private tombs = new Map<string, Tombstone>();
  private pullCursors = new Map<string, number>();
  private pushCursors = new Map<string, number>();

  constructor(private deviceId: string) {
    for (const t of SYNC_TABLE_ORDER) this.tables.set(t, new Map());
  }

  getDeviceId() {
    return this.deviceId;
  }

  async getPullCursor(peer: string) {
    return this.pullCursors.get(peer) ?? 0;
  }
  async setPullCursor(peer: string, ms: number) {
    this.pullCursors.set(peer, ms);
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

  // --- Helpers de test: mutaciones "locales", como las haria la app. ---

  /** Alta/edicion local de una fila. */
  put(table: SyncTable, row: SyncRow) {
    this.tables.get(table)!.set(row.id, row);
  }

  /** Borrado fisico + lapida (vaciar papelera). */
  purge(table: SyncTable, id: string, deletedAt: number) {
    this.tables.get(table)!.delete(id);
    this.tombs.set(id, { id, tabla: table, updatedAt: deletedAt });
  }

  /** Vista ordenada y estable de una tabla, para comparar dispositivos. */
  snapshot(table: SyncTable) {
    return [...this.tables.get(table)!.values()]
      .map((r) => ({ id: r.id, updatedAt: r.updatedAt, v: r.v }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Numero de filas vivas en una tabla. */
  count(table: SyncTable) {
    return this.tables.get(table)!.size;
  }
}

export type Device = {
  store: MemStore;
  session: SyncSession;
  deviceId: string;
};

/** Crea un dispositivo de prueba con su store y sesion. */
export function makeDevice(id: string): Device {
  const store = new MemStore(id);
  return { store, session: new SyncSession(store), deviceId: id };
}

/** Helper para construir una SyncRow. */
export const row = (id: string, updatedAt: number, v?: string): SyncRow => ({
  id,
  updatedAt,
  ...(v !== undefined ? { v } : {}),
});
