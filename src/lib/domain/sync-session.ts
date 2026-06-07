/**
 * ============================================================================
 *  src/lib/domain/sync-session.ts — Orquestacion de una ronda de sync P2P
 * ============================================================================
 *
 *  Sobre el motor puro de domain/sync.ts (merge LWW + lapidas), este modulo
 *  define COMO transcurre una sincronizacion entre dos dispositivos, pero sin
 *  acoplarse ni a la BD ni a la red: trabaja contra dos interfaces inyectadas.
 *
 *    - SyncStore: lee/escribe los datos locales (filas por tabla, lapidas,
 *      cursor por par). Lo implementa la capa de datos (Lote F: sobre Drizzle)
 *      y, en los tests, un almacen en memoria.
 *    - RemotePeer: el dispositivo del otro lado, capaz de servir sus cambios.
 *      Lo implementa el transporte (Lote G: sobre la red); en los tests, un
 *      adaptador que envuelve otra SyncSession.
 *
 *  PROTOCOLO (pull, simetrico)
 *  ---------------------------
 *  Cada lado TIRA (pull) del otro de forma independiente. Una sincronizacion
 *  completa = A tira de B y B tira de A (ver `bidirectionalSync`).
 *
 *    1. Guardamos por par un cursor `lastPulledAt` = mayor updatedAt ya
 *       integrado de ese par.
 *    2. Para tirar, pedimos al par sus filas/lapidas con updatedAt > cursor
 *       (`peer.requestChanges`, servido por `serve` en el otro lado).
 *    3. Fusionamos (LWW por id), aplicamos solo lo que gana, propagamos
 *       borrados via lapidas, y avanzamos el cursor.
 *
 *  Como el merge es idempotente, reaplicar algo ya conocido no rompe nada; el
 *  cursor solo evita retransmitir lo que no cambio.
 * ============================================================================
 */

import {
  type Millis,
  type Tombstone,
  type SyncTable,
  SYNC_TABLE_ORDER,
  collectChanges,
  mergeTable,
  mergeTombstones,
  idsKilledByTombstones,
} from "./sync";

/** Una fila sincronizable: como minimo id + updatedAt, mas el resto de campos. */
export type SyncRow = { id: string; updatedAt: Millis | Date } & Record<
  string,
  unknown
>;

/** Respuesta a una peticion de cambios: lo modificado tras un cursor. */
export interface PullResponse {
  /** Por tabla, las filas con updatedAt > cursor pedido. */
  tables: Record<string, SyncRow[]>;
  /** Lapidas con updatedAt > cursor pedido. */
  tombstones: Tombstone[];
  /** Mayor updatedAt incluido (el nuevo cursor del que pide). */
  maxMs: Millis;
}

/** Acceso a los datos locales que necesita la sesion de sync. */
export interface SyncStore {
  /** deviceId de ESTE dispositivo. */
  getDeviceId(): string;

  /** Cursor de pull guardado para un par (0 si nunca se sincronizo). */
  getPullCursor(peerDeviceId: string): Promise<Millis>;
  setPullCursor(peerDeviceId: string, ms: Millis): Promise<void>;

  /** Todas las filas (vivas) de una tabla. */
  getRows(table: SyncTable): Promise<SyncRow[]>;
  /** Inserta o actualiza filas (upsert por id). */
  applyRows(table: SyncTable, rows: SyncRow[]): Promise<void>;
  /** Borra filas por id (al aplicar una lapida). */
  deleteRows(table: SyncTable, ids: string[]): Promise<void>;

  /** Todas las lapidas conocidas. */
  getTombstones(): Promise<Tombstone[]>;
  /** Inserta o actualiza lapidas. */
  applyTombstones(tombstones: Tombstone[]): Promise<void>;
}

/** El dispositivo del otro lado, capaz de servir sus cambios. */
export interface RemotePeer {
  readonly deviceId: string;
  /** Devuelve los cambios del par posteriores a `sinceMs`. */
  requestChanges(sinceMs: Millis): Promise<PullResponse>;
}

/** Resumen de lo aplicado en un pull. */
export interface PullStats {
  appliedRows: number;
  appliedTombstones: number;
  deletedRows: number;
  cursor: Millis;
}

export class SyncSession {
  constructor(private readonly store: SyncStore) {}

  /**
   * Sirve una peticion de cambios de un par: nuestras filas/lapidas con
   * updatedAt > sinceMs. No muta nada local.
   */
  async serve(sinceMs: Millis): Promise<PullResponse> {
    const tables: Record<string, SyncRow[]> = {};
    let maxMs = sinceMs;

    for (const table of SYNC_TABLE_ORDER) {
      const rows = await this.store.getRows(table);
      const { changes, cursor } = collectChanges(rows, sinceMs);
      tables[table] = changes;
      if (cursor > maxMs) maxMs = cursor;
    }

    const tombs = await this.store.getTombstones();
    const { changes: tombChanges, cursor: tombCursor } = collectChanges(
      tombs,
      sinceMs,
    );
    if (tombCursor > maxMs) maxMs = tombCursor;

    return { tables, tombstones: tombChanges, maxMs };
  }

  /**
   * Tira de un par: pide sus cambios desde nuestro cursor, los fusiona en
   * local (LWW), propaga borrados via lapidas y avanza el cursor.
   */
  async pullFrom(peer: RemotePeer): Promise<PullStats> {
    const ctx = {
      localDeviceId: this.store.getDeviceId(),
      remoteDeviceId: peer.deviceId,
    };
    const since = await this.store.getPullCursor(peer.deviceId);
    const resp = await peer.requestChanges(since);

    // 1. Upsert de filas que ganan, en orden FK-seguro (padres antes).
    let appliedRows = 0;
    for (const table of SYNC_TABLE_ORDER) {
      const remoteRows = resp.tables[table];
      if (!remoteRows || remoteRows.length === 0) continue;
      const localRows = await this.store.getRows(table);
      const { toApplyLocally } = mergeTable(localRows, remoteRows, ctx);
      if (toApplyLocally.length > 0) {
        await this.store.applyRows(table, toApplyLocally);
        appliedRows += toApplyLocally.length;
      }
    }

    // 2. Fusiona las lapidas recibidas con las nuestras.
    let appliedTombstones = 0;
    if (resp.tombstones.length > 0) {
      const localTombs = await this.store.getTombstones();
      const { toApplyLocally } = mergeTombstones(localTombs, resp.tombstones, ctx);
      if (toApplyLocally.length > 0) {
        await this.store.applyTombstones(toApplyLocally);
        appliedTombstones = toApplyLocally.length;
      }
    }

    // 3. Aplica los borrados: cada lapida mata su fila viva si es mas nueva.
    //    En orden FK INVERSO (hijos antes que padres).
    let deletedRows = 0;
    const allTombs = await this.store.getTombstones();
    if (allTombs.length > 0) {
      for (const table of [...SYNC_TABLE_ORDER].reverse()) {
        const rows = await this.store.getRows(table);
        const kill = idsKilledByTombstones(
          rows,
          allTombs.filter((t) => t.tabla === table),
        );
        if (kill.length > 0) {
          await this.store.deleteRows(table, kill);
          deletedRows += kill.length;
        }
      }
    }

    const cursor = Math.max(since, resp.maxMs);
    await this.store.setPullCursor(peer.deviceId, cursor);

    return { appliedRows, appliedTombstones, deletedRows, cursor };
  }
}

/** Envuelve una SyncSession como par remoto (para tests y para el bucle local). */
export function asRemotePeer(
  deviceId: string,
  session: SyncSession,
): RemotePeer {
  return {
    deviceId,
    requestChanges: (sinceMs) => session.serve(sinceMs),
  };
}

/**
 * Sincronizacion completa entre dos lados: cada uno tira del otro. El orden no
 * afecta al resultado final (el merge es conmutativo por LWW), pero hacemos los
 * dos pulls para que ambos queden convergidos tras la llamada.
 */
export async function bidirectionalSync(
  a: { session: SyncSession; deviceId: string },
  b: { session: SyncSession; deviceId: string },
): Promise<{ a: PullStats; b: PullStats }> {
  const aStats = await a.session.pullFrom(asRemotePeer(b.deviceId, b.session));
  const bStats = await b.session.pullFrom(asRemotePeer(a.deviceId, a.session));
  return { a: aStats, b: bStats };
}
