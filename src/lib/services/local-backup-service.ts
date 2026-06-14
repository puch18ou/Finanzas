/**
 * ============================================================================
 *  src/lib/services/local-backup-service.ts — Copias de seguridad locales
 * ============================================================================
 *
 *  Guarda copias COMPRIMIDAS (.json.gz) del backup completo en la carpeta de
 *  datos de la app (BaseDirectory.AppData/backups), una por dia. Rotacion: se
 *  conservan los N ficheros mas recientes (por dia, no por dia natural: los
 *  dias que no abres la app se saltan). Abrir varias veces el mismo dia
 *  sobrescribe el fichero de ese dia.
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

const BACKUP_DIR = "backups";
const PREFIX = "finanzas-";
const SUFFIX = ".json.gz";
/** Cuantos ficheros de backup conservar (los mas recientes). */
export const KEEP_BACKUPS = 10;

const FS = { baseDir: BaseDirectory.AppData } as const;

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

function pathFor(name: string): string {
  return `${BACKUP_DIR}/${name}`;
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

/** Lista las copias existentes, mas reciente primero. */
export async function listLocalBackups(): Promise<LocalBackupEntry[]> {
  if (!isTauriRuntime()) return [];
  if (!(await exists(BACKUP_DIR, FS))) return [];
  const entries = await readDir(BACKUP_DIR, FS);
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

/** Elimina los backups que excedan los `keep` mas recientes. */
async function rotate(keep: number): Promise<void> {
  const backups = await listLocalBackups();
  for (const old of backups.slice(keep)) {
    try {
      await remove(pathFor(old.name), FS);
    } catch {
      // best-effort
    }
  }
}

/**
 * Crea/sobrescribe la copia de HOY y rota. Devuelve el nombre del fichero o
 * null si no se pudo (sin runtime de Tauri, error de FS...).
 */
export async function createDailyBackup(
  backup: BackupService,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  await mkdir(BACKUP_DIR, { ...FS, recursive: true });
  const data = await backup.exportAll();
  const bytes = await gzip(JSON.stringify(data));
  const name = fileNameForDay(todayKey());
  await writeFile(pathFor(name), bytes, FS);
  await rotate(KEEP_BACKUPS);
  return name;
}

/** ¿Existe ya la copia de hoy? (para no re-exportar en cada apertura). */
export async function todayBackupExists(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return exists(pathFor(fileNameForDay(todayKey())), FS);
}

/** Lee y descomprime una copia, devolviendo el objeto BackupFile crudo. */
export async function readLocalBackup(name: string): Promise<unknown> {
  const bytes = await readFile(pathFor(name), FS);
  const text = await gunzip(bytes);
  return JSON.parse(text);
}

/** Restaura una copia: valida e importa (REEMPLAZA todos los datos). */
export async function restoreLocalBackup(
  backup: BackupService,
  name: string,
): Promise<void> {
  const obj = await readLocalBackup(name);
  backup.validateBackup(obj);
  await backup.importAll(obj as BackupFile);
}

/** Borra una copia concreta. */
export async function deleteLocalBackup(name: string): Promise<void> {
  await remove(pathFor(name), FS);
}
