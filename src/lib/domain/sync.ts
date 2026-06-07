/**
 * ============================================================================
 *  src/lib/domain/sync.ts — Motor de fusion para sincronizacion P2P
 * ============================================================================
 *
 *  Fase 2: la app pasa a ser multi-dispositivo (portatil + movil) con
 *  sincronizacion peer-to-peer, sin servidor central. Este modulo es la pieza
 *  PURA del modelo: dadas las filas locales y las que llegan de otro
 *  dispositivo, decide cual gana y que hay que escribir en local. Sin IO, sin
 *  BD, sin red — todo eso vive en la capa de servicios/transporte (Fase 2.1).
 *
 *  MODELO: last-write-wins (LWW) por registro, basado en estado
 *  --------------------------------------------------------------
 *  No usamos un log de operaciones. Como TODA tabla sincronizable ya tiene
 *  `updatedAt` (ms epoch) y `deletedAt` (tombstone), sincronizar es:
 *
 *    1. Cada dispositivo manda las filas con updatedAt > cursor-del-par
 *       (ver `collectChanges`).
 *    2. Para cada `id`, gana la fila con `updatedAt` mas reciente
 *       (ver `mergeRecord`). Un borrado es solo una fila con `deletedAt`
 *       puesto y un `updatedAt` mas nuevo: el LWW lo resuelve igual que una
 *       edicion, sin reglas especiales. (Requisito: borrar DEBE tocar
 *       updatedAt; lo garantizan los repos.)
 *    3. Empate exacto de updatedAt (mismo ms): desempata el `deviceId`. Es
 *       deterministico — ambos pares eligen la MISMA fila fisica (ver
 *       `compareVersions`).
 *
 *  Por que estado y no un oplog: el volumen de datos de finanzas personales es
 *  diminuto y escanear por `updatedAt` evita instrumentar las ~15
 *  repositories en cada escritura. Mas simple y robusto.
 *
 *  El `deviceId` (UUID por instalacion) NO viaja en cada fila: va en el "sobre"
 *  del mensaje de sync (quien lo envia). Por eso `mergeRecord` lo recibe por
 *  contexto y no exige columnas nuevas en el esquema.
 * ============================================================================
 */

/** Milisegundos desde epoch. */
export type Millis = number;

/**
 * Minimo que el motor necesita de una fila: su `id` y cuando se modifico por
 * ultima vez. `updatedAt` admite Date (lo que devuelve Drizzle) o number.
 */
export interface Versioned {
  id: string;
  updatedAt: Millis | Date;
}

/** Normaliza updatedAt (Date | number) a ms. */
export function toMillis(v: Millis | Date): Millis {
  return v instanceof Date ? v.getTime() : v;
}

/** Identidad de los dos dispositivos que participan en una fusion. */
export interface MergeContext {
  /** deviceId de ESTE dispositivo (el que aplica la fusion). */
  localDeviceId: string;
  /** deviceId del dispositivo que envio las filas remotas. */
  remoteDeviceId: string;
}

/** Quien gana al comparar dos versiones del mismo registro. */
export type MergeOutcome = "local" | "remote" | "equal";

/**
 * Compara dos versiones del MISMO registro y decide cual gana (LWW).
 *
 * Regla: gana el `updatedAt` mayor. En empate exacto, gana la fila del
 * dispositivo con el `deviceId` mayor lexicograficamente. Esto es
 * deterministico entre pares: en el dispositivo L el contexto es
 * {local:L, remote:R} y en R es {local:R, remote:L}; ambos acaban eligiendo
 * la misma fila fisica.
 *
 * "equal" solo se devuelve si updatedAt coincide Y los deviceId coinciden
 * (no deberia pasar entre dos dispositivos distintos): en ese caso da igual
 * cual se conserve.
 */
export function compareVersions(
  local: Versioned,
  remote: Versioned,
  ctx: MergeContext,
): MergeOutcome {
  const la = toMillis(local.updatedAt);
  const ra = toMillis(remote.updatedAt);
  if (la > ra) return "local";
  if (ra > la) return "remote";
  // Empate de tiempo: desempata el deviceId (deterministico en ambos pares).
  if (ctx.localDeviceId === ctx.remoteDeviceId) return "equal";
  return ctx.localDeviceId > ctx.remoteDeviceId ? "local" : "remote";
}

/**
 * Devuelve la version ganadora entre la local y la remota de un mismo registro.
 * Si remota gana, el llamador debe ESCRIBIR esa fila en local.
 */
export function mergeRecord<T extends Versioned>(
  local: T,
  remote: T,
  ctx: MergeContext,
): T {
  return compareVersions(local, remote, ctx) === "remote" ? remote : local;
}

/** Resultado de fusionar una tabla completa. */
export interface TableMergeResult<T> {
  /** Conjunto final ya fusionado (lo que deberia quedar en la tabla). */
  merged: T[];
  /**
   * Filas remotas que ganaron (insert nuevo o sobrescritura). Es lo unico que
   * hace falta UPSERTear en local; el resto ya estaba bien.
   */
  toApplyLocally: T[];
}

/**
 * Fusiona el conjunto local de una tabla con las filas remotas recibidas.
 * Empareja por `id`; para cada par aplica LWW. Las filas remotas con id nuevo
 * se anaden; las locales sin contrapartida remota se conservan tal cual.
 */
export function mergeTable<T extends Versioned>(
  locals: T[],
  remotes: T[],
  ctx: MergeContext,
): TableMergeResult<T> {
  const byId = new Map<string, T>();
  for (const row of locals) byId.set(row.id, row);

  const toApplyLocally: T[] = [];
  for (const remote of remotes) {
    const local = byId.get(remote.id);
    if (!local) {
      byId.set(remote.id, remote);
      toApplyLocally.push(remote);
      continue;
    }
    const winner = mergeRecord(local, remote, ctx);
    if (winner === remote) {
      byId.set(remote.id, remote);
      toApplyLocally.push(remote);
    }
  }

  return { merged: [...byId.values()], toApplyLocally };
}

/** Filas a enviar a un par mas el nuevo cursor a guardar tras enviarlas. */
export interface ChangeSet<T> {
  changes: T[];
  /** Nuevo cursor = mayor updatedAt enviado (o el cursor previo si no hay nada). */
  cursor: Millis;
}

/**
 * Selecciona las filas modificadas estrictamente despues de `sinceMs` (el
 * cursor que tenemos guardado para ese par) y calcula el nuevo cursor.
 *
 * Incluye tombstones (filas con deletedAt) automaticamente: para el motor son
 * filas normales con un updatedAt reciente.
 */
export function collectChanges<T extends Versioned>(
  rows: T[],
  sinceMs: Millis,
): ChangeSet<T> {
  let cursor = sinceMs;
  const changes: T[] = [];
  for (const row of rows) {
    const u = toMillis(row.updatedAt);
    if (u > sinceMs) {
      changes.push(row);
      if (u > cursor) cursor = u;
    }
  }
  return { changes, cursor };
}

/**
 * Orden FK-seguro para APLICAR cambios (insert/upsert) entre tablas. Respeta
 * las foreign keys: una tabla referenciada va antes que quien la referencia.
 * Para BORRAR habria que recorrerlo al reves. `sync_log` no se sincroniza (es
 * plomeria local).
 */
export const SYNC_TABLE_ORDER = [
  "currencies",
  "settings",
  "categories",
  "accounts",
  "investments",
  "goals",
  "mortgage",
  "other_debts",
  "movements",
  "investment_contributions",
  "recurring_rules",
  "objetivo_ahorro_tramos",
  "presupuesto_tramos",
] as const;

export type SyncTable = (typeof SYNC_TABLE_ORDER)[number];

// ============================================================================
//  LAPIDAS DE BORRADO (tombstones)
// ============================================================================
//
//  Cuando un registro se borra definitivamente (vaciar papelera), su fila
//  desaparece pero queda una lapida {id, tabla, updatedAt=cuando se borro}. La
//  lapida viaja por sync y "mata" la fila viva del mismo id en el otro
//  dispositivo, SIEMPRE que la lapida sea mas nueva que el ultimo cambio de esa
//  fila. Si la fila se edito DESPUES del borrado (edicion concurrente que gana
//  al delete), sobrevive — es el LWW habitual.
// ============================================================================

/** Una lapida es un registro versionado con la tabla de origen. */
export interface Tombstone extends Versioned {
  tabla: string;
}

/**
 * Fusiona el conjunto local de lapidas con las recibidas de un par (LWW por id,
 * igual que cualquier tabla). Reutiliza `mergeTable`.
 */
export function mergeTombstones(
  locals: Tombstone[],
  remotes: Tombstone[],
  ctx: MergeContext,
): TableMergeResult<Tombstone> {
  return mergeTable(locals, remotes, ctx);
}

/**
 * Dada una lista de filas vivas y las lapidas conocidas, devuelve los `id` que
 * deben BORRARSE en local: aquellos con una lapida cuyo momento es
 * estrictamente posterior al `updatedAt` de la fila. Si la fila es mas nueva
 * que su lapida, sobrevive (no se devuelve).
 */
export function idsKilledByTombstones<T extends Versioned>(
  rows: T[],
  tombstones: Tombstone[],
): string[] {
  const byId = new Map<string, Millis>();
  for (const t of tombstones) byId.set(t.id, toMillis(t.updatedAt));

  const out: string[] = [];
  for (const row of rows) {
    const killed = byId.get(row.id);
    if (killed !== undefined && killed > toMillis(row.updatedAt)) {
      out.push(row.id);
    }
  }
  return out;
}
