/**
 * src/lib/sync/session-factory.ts — Crea una SyncSession sobre la BD activa.
 *
 * Punto unico para construir la sesion de sincronizacion (DbSyncStore sobre la
 * BD del usuario logueado + deviceId). Lo usan tanto la sync por fichero
 * (useSync) como la sync por LAN (servidor y cliente).
 */

import Database from "@tauri-apps/plugin-sql";
import { getDb } from "@/lib/db/client";
import { createDrizzleClient } from "@/lib/db/proxy-driver";
import { getDeviceId } from "@/lib/sync/device";
import { DbSyncStore } from "@/lib/sync/db-sync-store";
import { SyncSession, type PullResponse } from "@/lib/domain/sync-session";

export async function createSyncSession(): Promise<{
  session: SyncSession;
  deviceId: string;
}> {
  const db = await getDb();
  const deviceId = getDeviceId();
  const store = new DbSyncStore(db, deviceId);
  return { session: new SyncSession(store), deviceId };
}

/**
 * Sirve un snapshot completo (serve(0)) de la BD de un usuario concreto, sin
 * tocar la conexion activa. Lo usa el PC al aprovisionar un dispositivo nuevo:
 * abre la BD de ESE usuario y devuelve todos sus datos. No cierra la conexion
 * (el plugin la agrupa por ruta; cerrarla podria afectar a la activa).
 */
export async function serveSnapshotForDbFile(
  dbFile: string,
): Promise<PullResponse> {
  const tdb = await Database.load(`sqlite:${dbFile}`);
  const drizzle = createDrizzleClient(tdb);
  const store = new DbSyncStore(drizzle, "server");
  const session = new SyncSession(store);
  return session.serve(0);
}
