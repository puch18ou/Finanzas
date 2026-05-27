/**
 * ============================================================================
 *  src/lib/db/migrate.ts — Aplicador de migraciones SQL al arrancar
 * ============================================================================
 *
 *  Firma: runMigrations() → Promise<string[]>
 *  Devuelve la lista de nombres de las migraciones aplicadas EN ESTA llamada.
 *
 *  COMPATIBILIDAD CON BD EXISTENTES
 *  ---------------------------------
 *  Si la app se arranca contra una BD que ya fue migrada con un sistema
 *  anterior (Lote 2 inicial), las tablas YA existen pero la tabla
 *  `_migrations` puede estar vacia. En ese caso detectamos que las tablas
 *  ya existen y damos 0000_init por aplicada sin re-ejecutar el SQL.
 *
 *  Tambien aplicamos cada migracion con tolerancia a errores "ya existe":
 *  si una sentencia intermedia falla porque la tabla/columna ya existe,
 *  la saltamos en lugar de abortar.
 * ============================================================================
 */

import { sql } from "drizzle-orm";
import { getDb, getRawDb } from "./client";

import init0000 from "../../../drizzle/0000_init.sql?raw";
import migration0001 from "../../../drizzle/0001_add_mostrar_fab.sql?raw";
import migration0002 from "../../../drizzle/0002_integrar_cuota_hipoteca.sql?raw";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: "0000_init", sql: init0000 },
  { name: "0001_add_mostrar_fab", sql: migration0001 },
  { name: "0002_integrar_cuota_hipoteca", sql: migration0002 },
];

/**
 * Lista los errores de SQLite que consideramos "ya existe" — los ignoramos
 * porque significan que la operacion ya se hizo antes.
 */
function isAlreadyExistsError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate column") ||
    msg.includes("ya existe")
  );
}

export async function runMigrations(): Promise<string[]> {
  const db = await getRawDb();

  // Tabla de control: garantizamos que existe
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  // Detectamos si la BD ya tiene tablas de aplicacion ANTES de empezar.
  // Si `currencies` (la primera tabla de 0000_init) ya existe, asumimos
  // que 0000 fue aplicada por un sistema anterior.
  const existingTables = await db.select<{ name: string }[]>(
    `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name = 'currencies'
  `,
  );
  const baseSchemaExists = existingTables.length > 0;

  // Migraciones ya registradas
  const applied = await db.select<{ name: string }[]>(`
    SELECT name FROM _migrations
  `);
  const appliedSet = new Set(applied.map((r) => r.name));

  // Si las tablas ya existen pero 0000_init no esta registrada, la
  // damos por aplicada (migracion legacy desde Lote 2 original).
  if (baseSchemaExists && !appliedSet.has("0000_init")) {
    try {
      await db.select<{ name: string }[]>(` INSERT INTO _migrations
        (name, applied_at) VALUES ('0000_init', ${Date.now()})
      `);
      appliedSet.add("0000_init");
      console.log(
        "[migrate] 0000_init marcada como aplicada (BD pre-existente detectada)",
      );
    } catch (err) {
      console.error("REAL ERROR:", err);
    }
  }

  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.name)) continue;

    const statements = splitSqlStatements(migration.sql);
    let anyApplied = false;

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      try {
        await db.execute(trimmed);
        anyApplied = true;
      } catch (err) {
        if (isAlreadyExistsError(err)) {
          // Ya existe (columna, tabla, indice...). Lo saltamos.
          console.warn(
            `[migrate] ${migration.name}: salto sentencia ya aplicada: ${trimmed.slice(0, 80)}...`,
          );
          continue;
        }
        // Error real: re-lanzamos
        throw err;
      }
    }

    // Aunque todas las sentencias fueran "ya existe", igual marcamos la
    // migracion como aplicada para no reintentar la proxima vez.
    void anyApplied;

    await db.select<{ name: string }[]>(`
      INSERT INTO _migrations (name, applied_at) VALUES (${migration.name}, ${Date.now()})
    `);

    console.log(`[migrate] Aplicada migracion: ${migration.name}`);
    newlyApplied.push(migration.name);
  }

  return newlyApplied;
}

/**
 * Divide un script SQL en sentencias individuales, respetando strings y
 * comentarios.
 */
function splitSqlStatements(sql: string): string[] {
  const result: string[] = [];
  let current = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === "'") inString = false;
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ";") {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}
