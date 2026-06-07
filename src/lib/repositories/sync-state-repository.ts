/**
 * ============================================================================
 *  src/lib/repositories/sync-state-repository.ts — Cursores de sync P2P
 * ============================================================================
 *
 *  CRUD de la tabla `sync_state`: el estado LOCAL de sincronizacion con cada
 *  dispositivo-par conocido (cursores last_pulled_at / last_pushed_at). No se
 *  sincroniza; es plomeria del propio dispositivo.
 *
 *  La logica de QUE filas enviar / como fusionar vive en el dominio
 *  (src/lib/domain/sync.ts); este repo solo persiste los cursores.
 * ============================================================================
 */

import { eq } from "drizzle-orm";
import {
  syncState,
  type SyncState,
  type NewSyncState,
} from "@/lib/db/schema";
import { BaseRepository, now } from "./base";

export class SyncStateRepository extends BaseRepository {
  /** Todos los pares conocidos. */
  async list(): Promise<SyncState[]> {
    return this.db.select().from(syncState);
  }

  async getByPeer(peerDeviceId: string): Promise<SyncState | null> {
    const rows = await this.db
      .select()
      .from(syncState)
      .where(eq(syncState.peerDeviceId, peerDeviceId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Devuelve la fila del par, creandola vacia (sin cursores) si no existia.
   * Util al iniciar una sync con un par recien descubierto.
   */
  async ensurePeer(
    peerDeviceId: string,
    peerNombre?: string | null,
  ): Promise<SyncState> {
    const existing = await this.getByPeer(peerDeviceId);
    if (existing) return existing;

    const ts = now();
    const row: NewSyncState = {
      peerDeviceId,
      peerNombre: peerNombre ?? null,
      lastPulledAt: null,
      lastPushedAt: null,
      lastSyncAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.db.insert(syncState).values(row);

    const created = await this.getByPeer(peerDeviceId);
    if (!created) throw new Error("post-insert read failed");
    return created;
  }

  /** Actualiza el cursor de PULL (mayor updatedAt ya integrado de ese par). */
  async setPulledCursor(
    peerDeviceId: string,
    cursor: Date,
  ): Promise<void> {
    const ts = now();
    await this.db
      .update(syncState)
      .set({ lastPulledAt: cursor, lastSyncAt: ts, updatedAt: ts })
      .where(eq(syncState.peerDeviceId, peerDeviceId));
  }

  /** Actualiza el cursor de PUSH (mayor updatedAt ya enviado a ese par). */
  async setPushedCursor(
    peerDeviceId: string,
    cursor: Date,
  ): Promise<void> {
    const ts = now();
    await this.db
      .update(syncState)
      .set({ lastPushedAt: cursor, lastSyncAt: ts, updatedAt: ts })
      .where(eq(syncState.peerDeviceId, peerDeviceId));
  }

  /** Olvida un par (borra su fila de estado). */
  async forgetPeer(peerDeviceId: string): Promise<void> {
    await this.db
      .delete(syncState)
      .where(eq(syncState.peerDeviceId, peerDeviceId));
  }
}
