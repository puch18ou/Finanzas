/**
 * drizzle.config.ts — Configuracion de drizzle-kit (la CLI de Drizzle).
 *
 * drizzle-kit es la herramienta que genera ficheros SQL de migracion a
 * partir de los cambios en `schema.ts`. Se invoca con `npm run db:generate`.
 *
 * Importante: esta configuracion es SOLO para generacion de migraciones en
 * tiempo de desarrollo. NO se usa en runtime; en runtime la app se conecta
 * a la BD a traves de Tauri (ver src/lib/db/client.ts).
 *
 * No definimos `dbCredentials` aqui porque no necesitamos que drizzle-kit
 * se conecte a una BD real para generar migraciones: trabaja a nivel de
 * diff entre el schema TypeScript y los snapshots previos en /drizzle.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Donde vive el esquema (single source of truth).
  schema: "./src/lib/db/schema.ts",

  // Donde se generan los ficheros SQL y los snapshots de meta.
  out: "./drizzle",

  // Dialecto de la BD. SQLite tanto en local (Fase A) como en Turso (Fase C).
  dialect: "sqlite",

  // Mostrar el diff antes de generar.
  verbose: true,

  // No preguntar interactivamente en CI / scripts; aqui nos da igual porque
  // siempre vamos a revisar el SQL antes de commitearlo.
  strict: true,
});
