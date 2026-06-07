/**
 * ============================================================================
 *  src/lib/sync/db-sync-store.ts — SyncStore sobre Drizzle (Fase 2, Lote F)
 * ============================================================================
 *
 *  Implementacion real del `SyncStore` que usa la sesion de sync
 *  (domain/sync-session.ts): lee y escribe las filas de cada tabla, las
 *  lapidas y los cursores por par, contra la BD SQLite via Drizzle.
 *
 *  Trabaja de forma GENERICA sobre las tablas de SYNC_TABLE_ORDER usando un
 *  mapa nombre -> tabla Drizzle. Para sincronizar:
 *    - lee TODAS las filas (incluidas las soft-deleted: su deletedAt viaja para
 *      propagar el borrado logico),
 *    - upsertea por clave primaria (id, o code en currencies),
 *    - revive timestamps numericos (ms) a Date para las columnas de fecha,
 *      de modo que tambien funcione con filas que llegan serializadas de un par
 *      (el transporte de red es el Lote G).
 * ============================================================================
 */

import { eq, inArray, getTableColumns } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  currencies,
  settings,
  categories,
  accounts,
  investments,
  goals,
  mortgage,
  otherDebts,
  movements,
  investmentContributions,
  recurringRules,
  objetivoAhorroTramos,
  presupuestoTramos,
  tombstones,
  syncState,
} from "@/lib/db/schema";
import {
  type Millis,
  type Tombstone,
  type SyncTable,
} from "@/lib/domain/sync";
import type { SyncRow, SyncStore } from "@/lib/domain/sync-session";

/** Tabla Drizzle por nombre de SYNC_TABLE_ORDER. */
const TABLE_BY_NAME: Record<SyncTable, SQLiteTable> = {
  currencies,
  settings,
  categories,
  accounts,
  investments,
  goals,
  mortgage,
  other_debts: otherDebts,
  movements,
  investment_contributions: investmentContributions,
  recurring_rules: recurringRules,
  objetivo_ahorro_tramos: objetivoAhorroTramos,
  presupuesto_tramos: presupuestoTramos,
};

/** Nombre (en JS) de la columna clave primaria de cada tabla. */
const PK_PROP: Record<SyncTable, string> = {
  currencies: "code",
  settings: "id",
  categories: "id",
  accounts: "id",
  investments: "id",
  goals: "id",
  mortgage: "id",
  other_debts: "id",
  movements: "id",
  investment_contributions: "id",
  recurring_rules: "id",
  objetivo_ahorro_tramos: "id",
  presupuesto_tramos: "id",
};

/** Convierte timestamps numericos (ms) a Date en las columnas de fecha. */
function reviveDates(
  table: SQLiteTable,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const cols = getTableColumns(table) as Record<string, AnySQLiteColumn>;
  const out: Record<string, unknown> = { ...row };
  for (const [prop, col] of Object.entries(cols)) {
    const v = out[prop];
    if (v == null) continue;
    if (col.dataType === "date" && typeof v === "number") {
      out[prop] = new Date(v);
    } else if (col.dataType === "boolean" && typeof v === "number") {
      out[prop] = v !== 0;
    }
  }
  return out;
}

export class DbSyncStore implements SyncStore {
  constructor(
    private readonly db: DrizzleDb,
    private readonly deviceId: string,
  ) {}

  getDeviceId(): string {
    return this.deviceId;
  }

  // -- Cursores por par (tabla sync_state) -----------------------------------

  async getPullCursor(peerDeviceId: string): Promise<Millis> {
    const rows = await this.db
      .select({ at: syncState.lastPulledAt })
      .from(syncState)
      .where(eq(syncState.peerDeviceId, peerDeviceId))
      .limit(1);
    const at = rows[0]?.at;
    return at instanceof Date ? at.getTime() : 0;
  }

  async setPullCursor(peerDeviceId: string, ms: Millis): Promise<void> {
    const now = new Date();
    const cursor = new Date(ms);
    await this.db
      .insert(syncState)
      .values({
        peerDeviceId,
        lastPulledAt: cursor,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: syncState.peerDeviceId,
        set: { lastPulledAt: cursor, lastSyncAt: now, updatedAt: now },
      });
  }

  // -- Filas por tabla -------------------------------------------------------

  async getRows(table: SyncTable): Promise<SyncRow[]> {
    const rows = await this.db.select().from(TABLE_BY_NAME[table]);
    return rows as unknown as SyncRow[];
  }

  async applyRows(table: SyncTable, rows: SyncRow[]): Promise<void> {
    if (rows.length === 0) return;
    const t = TABLE_BY_NAME[table];
    const cols = getTableColumns(t) as Record<string, AnySQLiteColumn>;
    const pkCol = cols[PK_PROP[table]] as AnySQLiteColumn;

    for (const raw of rows) {
      const values = reviveDates(t, raw as Record<string, unknown>);
      // Upsert: si ya existe la PK, sobrescribe con la version remota (que ya
      // sabemos que gana por LWW; la sesion solo pasa las ganadoras).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db
        .insert(t)
        .values(values as never)
        .onConflictDoUpdate({ target: pkCol, set: values as never });
    }
  }

  async deleteRows(table: SyncTable, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const t = TABLE_BY_NAME[table];
    const cols = getTableColumns(t) as Record<string, AnySQLiteColumn>;
    const pkCol = cols[PK_PROP[table]] as AnySQLiteColumn;
    await this.db.delete(t).where(inArray(pkCol, ids));
  }

  // -- Lapidas ---------------------------------------------------------------

  async getTombstones(): Promise<Tombstone[]> {
    const rows = await this.db.select().from(tombstones);
    return rows as unknown as Tombstone[];
  }

  async applyTombstones(ts: Tombstone[]): Promise<void> {
    if (ts.length === 0) return;
    for (const t of ts) {
      const at = t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt);
      await this.db
        .insert(tombstones)
        .values({
          id: t.id,
          tabla: t.tabla,
          deletedAt: at,
          createdAt: at,
          updatedAt: at,
        })
        .onConflictDoUpdate({
          target: tombstones.id,
          set: { tabla: t.tabla, deletedAt: at, updatedAt: at },
        });
    }
  }
}
