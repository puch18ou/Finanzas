/**
 * ============================================================================
 *  src/lib/db/migrate.ts — Aplicador de migraciones al arrancar
 * ============================================================================
 *
 *  POR QUE NO USAMOS DRIZZLE-KIT MIGRATE EN RUNTIME
 *  -------------------------------------------------
 *  La CLI `drizzle-kit migrate` necesita acceso al filesystem y a Node.js,
 *  pero nuestra app corre dentro de un webview (no es Node). Asi que
 *  implementamos nuestro propio runner minimo: lee los SQL bundleados con
 *  la app y los aplica uno a uno, llevando registro en una tabla
 *  __migrations.
 *
 *  COMO SE BUNDLEAN LOS SQL
 *  ------------------------
 *  Los ficheros de /drizzle/*.sql se importan como STRING en tiempo de
 *  build gracias a Next/Webpack. Cada SQL se convierte en un import:
 *
 *      import init0 from '../../../drizzle/0000_init.sql?raw';
 *
 *  El sufijo `?raw` es una convencion de Vite/Webpack para cargar un
 *  fichero como texto crudo en lugar de ejecutarlo. Next 16 lo soporta
 *  via Turbopack.
 *
 *  ORDEN
 *  -----
 *  Las migraciones llevan prefijo numerico (0000_, 0001_, ...). Se aplican
 *  en orden y solo se aplica una migracion si su nombre NO esta ya en la
 *  tabla __migrations.
 *
 *  STATEMENT-BREAKPOINT
 *  --------------------
 *  Drizzle marca el limite entre statements con el comentario
 *      --> statement-breakpoint
 *  Esto es necesario porque algunos drivers SQLite no aceptan multiples
 *  statements en un solo `execute`. El plugin de Tauri tampoco. Asi que
 *  partimos el SQL por ese delimitador y ejecutamos cada statement por
 *  separado.
 * ============================================================================
 */

import { getRawDb } from "./client";

// Importacion del SQL como texto crudo. El `?raw` lo soporta Next 16 con
// Turbopack y Webpack. Cuando anadamos mas migraciones, se anade aqui.
import init0000 from "../../../drizzle/0000_init.sql?raw";

/**
 * Lista ordenada de migraciones disponibles.
 * Cuando generes una nueva con `npm run db:generate`, la agregas aqui.
 */
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: "0000_init", sql: init0000 },
];

/**
 * Crea la tabla __migrations si no existe. Lleva el log de migraciones
 * ya aplicadas para que cada una solo se ejecute una vez.
 */
async function ensureMigrationsTable(): Promise<void> {
  const db = await getRawDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
}

/**
 * Devuelve el conjunto de migraciones ya aplicadas (sus nombres).
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const db = await getRawDb();
  const rows = await db.select<{ name: string }[]>(
    "SELECT name FROM __migrations",
  );
  return new Set(rows.map((r) => r.name));
}

/**
 * Divide un SQL multi-statement (con --> statement-breakpoint) en
 * statements individuales, eliminando los delimitadores y trimming.
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Aplica una migracion entera: ejecuta cada statement y luego inserta
 * la marca en __migrations. NO usa transaccion porque el plugin SQL de
 * Tauri no expone API de transacciones explicitas en JS de momento; si
 * algun statement falla, el usuario lo vera en consola y resolveremos.
 *
 * En produccion (cuando la app sea estable) las migraciones nunca fallan
 * porque vienen validadas con drizzle-kit. En desarrollo, fallar mientras
 * trabajamos en el esquema es esperable.
 */
async function applyMigration(migration: {
  name: string;
  sql: string;
}): Promise<void> {
  const db = await getRawDb();
  const statements = splitStatements(migration.sql);

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  await db.execute("INSERT INTO __migrations (name, applied_at) VALUES (?, ?)", [
    migration.name,
    Date.now(),
  ]);
}

/**
 * Punto de entrada: aplica todas las migraciones pendientes en orden.
 * Idempotente: si ya estan todas aplicadas, no hace nada.
 *
 * Devuelve la lista de migraciones que se aplicaron en esta llamada
 * (vacia si no habia ninguna pendiente).
 */
export async function runMigrations(): Promise<string[]> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const pending = MIGRATIONS.filter((m) => !applied.has(m.name));
  for (const migration of pending) {
    await applyMigration(migration);
  }

  return pending.map((m) => m.name);
}
