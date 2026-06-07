/**
 * ============================================================================
 *  src/lib/repositories/tombstone-repository.ts — Lapidas de borrado (sync P2P)
 * ============================================================================
 *
 *  Registra y consulta las lapidas (`tombstones`): marcas ligeras que
 *  sobreviven al borrado fisico de un registro para que el borrado se propague
 *  a los demas dispositivos. Ver schema.ts (tombstones) y domain/sync.ts
 *  (idsKilledByTombstones / mergeTombstones).
 * ============================================================================
 */

import { gt } from "drizzle-orm";
import {
  tombstones,
  type Tombstone,
  type NewTombstone,
} from "@/lib/db/schema";
import type { SyncTable } from "@/lib/domain/sync";
import { BaseRepository, now } from "./base";

export class TombstoneRepository extends BaseRepository {
  /** Registra una lapida (idempotente: si ya existe el id, la deja). */
  async record(id: string, tabla: SyncTable): Promise<void> {
    const ts = now();
    const row: NewTombstone = {
      id,
      tabla,
      deletedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
    // INSERT OR IGNORE: si el id ya tiene lapida, no la pisamos (conserva la
    // fecha original de borrado).
    await this.db.insert(tombstones).values(row).onConflictDoNothing();
  }

  /** Registra varias lapidas de una tabla en bloque. */
  async recordMany(ids: string[], tabla: SyncTable): Promise<void> {
    if (ids.length === 0) return;
    const ts = now();
    const rows: NewTombstone[] = ids.map((id) => ({
      id,
      tabla,
      deletedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    }));
    await this.db.insert(tombstones).values(rows).onConflictDoNothing();
  }

  /** Todas las lapidas. */
  async list(): Promise<Tombstone[]> {
    return this.db.select().from(tombstones);
  }

  /** Lapidas con updatedAt posterior al cursor (para enviar a un par). */
  async changedSince(cursor: Date): Promise<Tombstone[]> {
    return this.db
      .select()
      .from(tombstones)
      .where(gt(tombstones.updatedAt, cursor));
  }
}
