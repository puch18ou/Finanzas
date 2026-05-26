/**
 * ============================================================================
 *  src/lib/db/proxy-driver.ts — Adaptador Drizzle <-> tauri-plugin-sql
 * ============================================================================
 *
 *  PROBLEMA QUE RESUELVE
 *  ---------------------
 *  Drizzle ofrece varios "drivers" oficiales (better-sqlite3, libsql,
 *  node:sqlite, etc.) pero ninguno habla directamente con el plugin SQL
 *  de Tauri. El plugin de Tauri expone solo dos metodos JS:
 *
 *      Database.execute(query, bindValues)  // INSERT/UPDATE/DELETE/CREATE
 *      Database.select(query, bindValues)   // SELECT
 *
 *  Por suerte, Drizzle tiene un driver llamado "sqlite-proxy" (oficial)
 *  pensado exactamente para esto: tu le pasas una funcion `executeQuery`
 *  y Drizzle delega todas las queries en ella. Lo unico que tenemos que
 *  hacer es traducir entre el formato esperado por Drizzle y la API del
 *  plugin de Tauri.
 *
 *  ESTRATEGIA
 *  ----------
 *  1. Distinguimos lectura de escritura por el comando SQL (palabra inicial).
 *  2. Para escritura llamamos `db.execute(...)`.
 *  3. Para lectura llamamos `db.select(...)` y reformateamos las filas
 *     al formato que espera Drizzle (array de arrays, no array de objetos).
 *
 *  CONTRATO DE DRIZZLE PROXY
 *  -------------------------
 *  La funcion `executeQuery` recibe (sql, params, method) y debe devolver
 *  `{ rows: unknown[][] }` para SELECT y `{ rows: [] }` para escrituras.
 *
 *  Documentacion oficial:
 *    https://orm.drizzle.team/docs/connect-drizzle-proxy
 * ============================================================================
 */

import { drizzle } from "drizzle-orm/sqlite-proxy";
import type Database from "@tauri-apps/plugin-sql";
import * as schema from "./schema";

/**
 * Comandos SQL que NO devuelven filas (escrituras y DDL).
 * Los detectamos por la primera palabra de la query, en mayusculas.
 */
const WRITE_COMMANDS = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
  "PRAGMA",
  "VACUUM",
  "REINDEX",
  "ANALYZE",
]);

function isWriteQuery(sql: string): boolean {
  const firstWord = sql.trim().split(/\s+/)[0]?.toUpperCase();
  return firstWord !== undefined && WRITE_COMMANDS.has(firstWord);
}

/**
 * Crea una instancia de Drizzle conectada al plugin SQL de Tauri.
 *
 * @param tauriDb  Instancia de @tauri-apps/plugin-sql ya cargada
 *                 con `await Database.load('sqlite:finanzas.db')`.
 * @returns Cliente Drizzle con tipos del esquema.
 *
 * Uso tipico:
 *
 *   const tauriDb = await Database.load('sqlite:finanzas.db');
 *   const db = createDrizzleClient(tauriDb);
 *   const monedas = await db.select().from(schema.currencies);
 */
export function createDrizzleClient(tauriDb: Database) {
  return drizzle(
    // Funcion de query: Drizzle nos pasa (sql, params, method) y debemos
    // devolver { rows: array_de_arrays }.
    async (sql, params, method) => {
      try {
        if (isWriteQuery(sql) || method === "run") {
          // Escritura: el plugin Tauri devuelve { rowsAffected, lastInsertId }
          // pero Drizzle no necesita esos datos para INSERT/UPDATE/DELETE
          // basicos, asi que devolvemos rows vacio.
          await tauriDb.execute(sql, params);
          return { rows: [] };
        }

        // Lectura: el plugin devuelve un array de OBJETOS (cada uno con las
        // columnas como claves). Drizzle espera un array de ARRAYS (cada uno
        // con los valores en orden de columna), asi que reconvertimos.
        //
        // Para conservar el ORDEN de columnas que la query produjo, usamos
        // las claves del primer objeto como referencia. Si el resultado
        // viene vacio, devolvemos vacio.
        const result = await tauriDb.select<Record<string, unknown>[]>(
          sql,
          params,
        );

        if (!Array.isArray(result) || result.length === 0) {
          return { rows: [] };
        }

        const columns = Object.keys(result[0]!);
        const rows = result.map((row) => columns.map((col) => row[col]));

        // Para queries con method='get' (single row) Drizzle espera
        // directamente la fila, no un array de filas envuelto en rows.
        // El driver sqlite-proxy de Drizzle ya se encarga internamente
        // de hacer rows[0] si method === 'get', asi que con devolver
        // siempre el array completo nos vale.
        return { rows };
      } catch (error) {
        // Re-lanzamos enriquecido para que sea facil depurar.
        const message =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `[drizzle-proxy] Error ejecutando query:\n  SQL: ${sql}\n  Params: ${JSON.stringify(
            params,
          )}\n  Causa: ${message}`,
        );
      }
    },
    // Schema: permite usar el modo "relational queries" (db.query.tabla...)
    // y mejora la inferencia de tipos.
    { schema, logger: false },
  );
}

/**
 * Tipo del cliente Drizzle ya conectado. Se usa en repositorios y hooks
 * para tipar parametros.
 */
export type DrizzleDb = ReturnType<typeof createDrizzleClient>;
