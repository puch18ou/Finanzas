/**
 * ============================================================================
 *  src/lib/services/local-backup-service.ts — Copias de seguridad locales
 * ============================================================================
 *
 *  Guarda copias COMPRIMIDAS (.json.gz) del backup completo en la carpeta de
 *  datos de la app, una por dia. Rotacion: se conservan los N ficheros mas
 *  recientes (por dia, no por dia natural: los dias que no abres la app se
 *  saltan). Abrir varias veces el mismo dia sobrescribe el fichero de ese dia.
 *
 *  AISLAMIENTO POR USUARIO (multiusuario, Lote 12): cada usuario guarda sus
 *  copias en su PROPIA subcarpeta `backups/<idUsuario>/`. Antes iban todas a
 *  `backups/` a secas, asi que un usuario veia (y podia restaurar) las copias
 *  de otro -> fuga de datos entre usuarios del mismo equipo. Por eso todas las
 *  funciones reciben el `userId` del usuario activo.
 *
 *  Es un backup de VERDAD: vive como fichero aparte, sobrevive aunque la BD
 *  se corrompa. Requiere el plugin tauri-plugin-fs (escritorio y movil).
 *
 *  La compresion usa CompressionStream/DecompressionStream del WebView (gzip),
 *  sin dependencias extra.
 * ============================================================================
 */

import {
  mkdir,
  writeFile,
  readFile,
  readDir,
  remove,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import type { BackupService, BackupFile } from "./backup-service";

const BACKUP_ROOT = "backups";
const PREFIX = "finanzas-";
const SUFFIX = ".json.gz";
/** Cuantos ficheros de backup conservar (los mas recientes). */
export const KEEP_BACKUPS = 10;

const FS = { baseDir: BaseDirectory.AppData } as const;

/**
 * Subcarpeta de copias del usuario `userId`, saneando el id para que sea un
 * nombre de carpeta seguro (los ids son internos, pero evitamos sorpresas con
 * separadores de ruta). Cada usuario queda aislado en su propia carpeta.
 */
function backupDir(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${BACKUP_ROOT}/${safe}`;
}

/** ¿Estamos dentro del runtime de Tauri? (en `next dev` puro no hay FS). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Fecha local de hoy como YYYY-MM-DD (es "hoy" para el usuario, instante). */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fileNameForDay(dayKey: string): string {
  return `${PREFIX}${dayKey}${SUFFIX}`;
}

function pathFor(userId: string, name: string): string {
  return `${backupDir(userId)}/${name}`;
}

/** Extrae la fecha (YYYY-MM-DD) del nombre de fichero, o null si no encaja. */
export function backupDayFromName(name: string): string | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return null;
  return name.slice(PREFIX.length, name.length - SUFFIX.length) || null;
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export type LocalBackupEntry = {
  /** Nombre del fichero (finanzas-YYYY-MM-DD.json.gz). */
  name: string;
  /** Dia del backup (YYYY-MM-DD). */
  dia: string;
};

/** Lista las copias del usuario `userId`, mas reciente primero. */
export async function listLocalBackups(
  userId: string,
): Promise<LocalBackupEntry[]> {
  if (!isTauriRuntime()) return [];
  const dir = backupDir(userId);
  if (!(await exists(dir, FS))) return [];
  const entries = await readDir(dir, FS);
  const backups: LocalBackupEntry[] = [];
  for (const e of entries) {
    if (!e.isFile) continue;
    const dia = backupDayFromName(e.name);
    if (!dia) continue;
    backups.push({ name: e.name, dia });
  }
  // El nombre YYYY-MM-DD ordena cronologicamente: descendente = mas nuevo 1o.
  backups.sort((a, b) => b.dia.localeCompare(a.dia));
  return backups;
}

/** Elimina los backups del usuario que excedan los `keep` mas recientes. */
async function rotate(userId: string, keep: number): Promise<void> {
  const backups = await listLocalBackups(userId);
  for (const old of backups.slice(keep)) {
    try {
      await remove(pathFor(userId, old.name), FS);
    } catch {
      // best-effort
    }
  }
}

/**
 * Crea/sobrescribe la copia de HOY del usuario `userId` y rota. Devuelve el
 * nombre del fichero o null si no se pudo (sin runtime de Tauri, error de FS...).
 */
export async function createDailyBackup(
  backup: BackupService,
  userId: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  await mkdir(backupDir(userId), { ...FS, recursive: true });
  const data = await backup.exportAll();
  const bytes = await gzip(JSON.stringify(data));
  const name = fileNameForDay(todayKey());
  await writeFile(pathFor(userId, name), bytes, FS);
  await rotate(userId, KEEP_BACKUPS);
  return name;
}

/** ¿Existe ya la copia de hoy del usuario? (para no re-exportar al abrir). */
export async function todayBackupExists(userId: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return exists(pathFor(userId, fileNameForDay(todayKey())), FS);
}

/** Lee y descomprime una copia del usuario, devolviendo el BackupFile crudo. */
export async function readLocalBackup(
  userId: string,
  name: string,
): Promise<unknown> {
  const bytes = await readFile(pathFor(userId, name), FS);
  const text = await gunzip(bytes);
  return JSON.parse(text);
}

/** Restaura una copia del usuario: valida e importa (REEMPLAZA todos los datos). */
export async function restoreLocalBackup(
  backup: BackupService,
  userId: string,
  name: string,
): Promise<void> {
  const obj = await readLocalBackup(userId, name);
  backup.validateBackup(obj);
  await backup.importAll(obj as BackupFile);
}

/** Borra una copia concreta del usuario. */
export async function deleteLocalBackup(
  userId: string,
  name: string,
): Promise<void> {
  await remove(pathFor(userId, name), FS);
}
