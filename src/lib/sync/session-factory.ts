/**
 * src/lib/sync/session-factory.ts — Crea una SyncSession sobre la BD activa.
 *
 * Punto unico para construir la sesion de sincronizacion (DbSyncStore sobre la
 * BD del usuario logueado + deviceId). Lo usan tanto la sync por fichero
 * (useSync) como la sync por LAN (servidor y cliente).
 */

import { getDb } from "@/lib/db/client";
import { getDeviceId } from "@/lib/sync/device";
import { DbSyncStore } from "@/lib/sync/db-sync-store";
import { SyncSession } from "@/lib/domain/sync-session";

export async function createSyncSession(): Promise<{
  session: SyncSession;
  deviceId: string;
}> {
  const db = await getDb();
  const deviceId = getDeviceId();
  const store = new DbSyncStore(db, deviceId);
  return { session: new SyncSession(store), deviceId };
}
