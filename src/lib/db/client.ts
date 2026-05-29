/**
 * ============================================================================
 *  src/lib/db/client.ts — Punto unico de acceso a la base de datos
 * ============================================================================
 *
 *  Responsabilidad: cargar el fichero SQLite via Tauri, activar PRAGMAs
 *  necesarias y devolver una instancia de Drizzle ya conectada.
 *
 *  PATRON SINGLETON
 *  ----------------
 *  Solo queremos UNA conexion abierta para toda la app. El primer componente
 *  que llame `getDb()` la inicializa; los siguientes reusan la misma. Esto
 *  evita problemas de locking de SQLite con multiples handles abiertos.
 *
 *  PRAGMAS QUE ACTIVAMOS
 *  ---------------------
 *  - foreign_keys = ON: por defecto SQLite NO valida foreign keys (legado
 *    de SQLite 2.x). Hay que activarlo en cada conexion.
 *  - journal_mode = WAL: write-ahead log. Mejor rendimiento de escritura y
 *    permite lecturas concurrentes con la escritura. Ideal para apps
 *    de escritorio.
 *  - synchronous = NORMAL: balance entre seguridad y velocidad. FULL es
 *    el default; NORMAL es la recomendacion oficial para WAL.
 *
 *  UBICACION DEL FICHERO
 *  ---------------------
 *  El plugin SQL de Tauri acepta una ruta tipo "sqlite:finanzas.db". Sin
 *  ruta absoluta, lo coloca en el AppDataDir de la app (segun OS):
 *    - Windows: %APPDATA%\personal.finanzas.app\finanzas.db
 *    - macOS:   ~/Library/Application Support/personal.finanzas.app/finanzas.db
 *    - Linux:   ~/.local/share/personal.finanzas.app/finanzas.db
 *
 *  Esta es la convencion correcta para datos de usuario en cada SO.
 * ============================================================================
 */

import Database from "@tauri-apps/plugin-sql";
import { createDrizzleClient, type DrizzleDb } from "./proxy-driver";

/**
 * Ruta de la BD ACTIVA. Es dinamica: cada usuario tiene su propio fichero
 * (multiusuario, Lote 12). Debe fijarse con setActiveDbPath() ANTES de getDb().
 * Mientras no haya sesion iniciada, es null y getDb() lanza.
 */
let _dbPath: string | null = null;

/** Ruta realmente abierta (para detectar cambios de usuario). */
let _openedPath: string | null = null;

/**
 * Estado interno del modulo. No exportado: solo se accede via getDb().
 */
let _tauriDb: Database | null = null;
let _drizzleDb: DrizzleDb | null = null;
let _initPromise: Promise<DrizzleDb> | null = null;

/**
 * Fija la BD activa (ej. "sqlite:user_<id>.db"). La conexion no se abre hasta
 * el siguiente getDb(). Si la ruta cambia respecto a la abierta, getDb()
 * reabrira sobre el nuevo fichero.
 */
export function setActiveDbPath(path: string): void {
  _dbPath = path;
}

/**
 * Obtiene la instancia de Drizzle conectada al SQLite local.
 * Idempotente: se puede llamar tantas veces como se quiera; solo la primera
 * inicializa la conexion.
 *
 * Si dos llamadas concurrentes llegan antes de terminar la inicializacion,
 * comparten la misma promesa (no se abren dos conexiones).
 */
export async function getDb(): Promise<DrizzleDb> {
  if (!_dbPath) {
    throw new Error(
      "No hay BD activa: inicia sesion antes de usar getDb() (multiusuario).",
    );
  }

  // Ya inicializado sobre la MISMA ruta: retorno directo.
  if (_drizzleDb && _openedPath === _dbPath) {
    return _drizzleDb;
  }

  // Inicializacion en curso: esperamos a la promesa existente.
  if (_initPromise) {
    return _initPromise;
  }

  const pathToOpen = _dbPath;

  // Primer caller: arrancamos la inicializacion.
  _initPromise = (async () => {
    // Cambio de usuario: abrimos la BD del nuevo fichero. NO cerramos la
    // conexion anterior a proposito. Cerrarla mientras una query en vuelo aun
    // la usa provoca "connection on a closed pool" (sobre todo en dev con
    // StrictMode/HMR). Cada usuario es un fichero .db distinto, asi que dejar
    // el pool anterior abierto no causa locks; se libera al cerrar la app.
    //
    // 1. Cargar el fichero SQLite via plugin Tauri.
    //    Si el fichero no existe, lo crea vacio.
    _tauriDb = await Database.load(pathToOpen);

    // 2. Activar PRAGMAs criticos. Estos se aplican en CADA conexion;
    //    SQLite no los persiste entre handles.
    await _tauriDb.execute("PRAGMA foreign_keys = ON");
    await _tauriDb.execute("PRAGMA journal_mode = WAL");
    await _tauriDb.execute("PRAGMA synchronous = NORMAL");

    // 3. Envolver con Drizzle y guardar el cliente.
    _drizzleDb = createDrizzleClient(_tauriDb);
    _openedPath = pathToOpen;
    return _drizzleDb;
  })();

  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

/**
 * Devuelve el handle directo al plugin Tauri (sin envoltorio Drizzle).
 * SOLO se debe usar para ejecutar SQL en crudo (ej. aplicar migraciones).
 * Para todo lo demas, usar getDb() y el cliente Drizzle.
 */
export async function getRawDb(): Promise<Database> {
  await getDb(); // asegura que _tauriDb este inicializado
  if (!_tauriDb) {
    throw new Error("getRawDb llamado antes de inicializar la BD");
  }
  return _tauriDb;
}

/**
 * Cierra la conexion. Util para tests o reinicios controlados.
 * En produccion no hace falta: la conexion vive lo que viva la app.
 */
export async function closeDb(): Promise<void> {
  if (_tauriDb) {
    await _tauriDb.close();
  }
  _tauriDb = null;
  _drizzleDb = null;
  _initPromise = null;
  _openedPath = null;
  _dbPath = null;
}
