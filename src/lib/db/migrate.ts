/**
 * src/lib/db/migrate.ts — añade migracion 0007_add_cuenta_pago.
 */

import { getDb, getRawDb } from "./client";

import init0000 from "../../../drizzle/0000_init.sql?raw";
import migration0001 from "../../../drizzle/0001_add_mostrar_fab.sql?raw";
import migration0002 from "../../../drizzle/0002_integrar_cuota_hipoteca.sql?raw";
import migration0003 from "../../../drizzle/0003_create_movements.sql?raw";
import migration0004 from "../../../drizzle/0004_drop_legacy_movement_tables.sql?raw";
import migration0005 from "../../../drizzle/0005_create_recurring_rules.sql?raw";
import migration0006 from "../../../drizzle/0006_migrate_monthly_incomes_to_movements.sql?raw";
import migration0007 from "../../../drizzle/0007_add_cuenta_pago.sql?raw";
import migration0008 from "../../../drizzle/0008_account_saldo_inicial.sql?raw";
import migration0009 from "../../../drizzle/0009_add_cuenta_por_defecto.sql?raw";
import migration0010 from "../../../drizzle/0010_investment_contributions.sql?raw";
import migration0011 from "../../../drizzle/0011_contribution_retirada.sql?raw";
import migration0012 from "../../../drizzle/0012_recurring_frecuencia.sql?raw";
import migration0013 from "../../../drizzle/0013_investment_archivada.sql?raw";
import migration0014 from "../../../drizzle/0014_settings_objetivo_ahorro_importe.sql?raw";
import migration0015 from "../../../drizzle/0015_remove_oro_tipo.sql?raw";
import migration0016 from "../../../drizzle/0016_investment_interes.sql?raw";
import migration0017 from "../../../drizzle/0017_investment_contributions_comision.sql?raw";
import migration0018 from "../../../drizzle/0018_settings_objetivo_ahorro_desde.sql?raw";
import migration0019 from "../../../drizzle/0019_objetivo_ahorro_tramos.sql?raw";
import migration0020 from "../../../drizzle/0020_presupuesto_tramos.sql?raw";
import migration0021 from "../../../drizzle/0021_investment_ultima_actualizacion_precio.sql?raw";
import migration0022 from "../../../drizzle/0022_investment_isin.sql?raw";
import migration0023 from "../../../drizzle/0023_investment_ultima_cotizacion_nav.sql?raw";
import migration0024 from "../../../drizzle/0024_investment_unidades_cotizacion.sql?raw";
import migration0025 from "../../../drizzle/0025_sync_state.sql?raw";
import migration0026 from "../../../drizzle/0026_tombstones.sql?raw";
import migration0027 from "../../../drizzle/0027_patrimonio_snapshots.sql?raw";
import migration0028 from "../../../drizzle/0028_movement_etiquetas.sql?raw";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: "0000_init", sql: init0000 },
  { name: "0001_add_mostrar_fab", sql: migration0001 },
  { name: "0002_integrar_cuota_hipoteca", sql: migration0002 },
  { name: "0003_create_movements", sql: migration0003 },
  { name: "0004_drop_legacy_movement_tables", sql: migration0004 },
  { name: "0005_create_recurring_rules", sql: migration0005 },
  { name: "0006_migrate_monthly_incomes_to_movements", sql: migration0006 },
  { name: "0007_add_cuenta_pago", sql: migration0007 },
  { name: "0008_account_saldo_inicial", sql: migration0008 },
  { name: "0009_add_cuenta_por_defecto", sql: migration0009 },
  { name: "0010_investment_contributions", sql: migration0010 },
  { name: "0011_contribution_retirada", sql: migration0011 },
  { name: "0012_recurring_frecuencia", sql: migration0012 },
  { name: "0013_investment_archivada", sql: migration0013 },
  { name: "0014_settings_objetivo_ahorro_importe", sql: migration0014 },
  { name: "0015_remove_oro_tipo", sql: migration0015 },
  { name: "0016_investment_interes", sql: migration0016 },
  { name: "0017_investment_contributions_comision", sql: migration0017 },
  { name: "0018_settings_objetivo_ahorro_desde", sql: migration0018 },
  { name: "0019_objetivo_ahorro_tramos", sql: migration0019 },
  { name: "0020_presupuesto_tramos", sql: migration0020 },
  {
    name: "0021_investment_ultima_actualizacion_precio",
    sql: migration0021,
  },
  { name: "0022_investment_isin", sql: migration0022 },
  {
    name: "0023_investment_ultima_cotizacion_nav",
    sql: migration0023,
  },
  {
    name: "0024_investment_unidades_cotizacion",
    sql: migration0024,
  },
  { name: "0025_sync_state", sql: migration0025 },
  { name: "0026_tombstones", sql: migration0026 },
  { name: "0027_patrimonio_snapshots", sql: migration0027 },
  { name: "0028_movement_etiquetas", sql: migration0028 },
];

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

function isMissingTableError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  return msg.includes("no such table");
}

export async function runMigrations(): Promise<string[]> {
  await getDb();
  const db = await getRawDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  const existingTables = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'currencies'`,
  );
  const baseSchemaExists = existingTables.length > 0;

  const applied = await db.select<{ name: string }[]>(
    `SELECT name FROM _migrations`,
  );
  const appliedSet = new Set(applied.map((r) => r.name));

  if (baseSchemaExists && !appliedSet.has("0000_init")) {
    try {
      await db.execute(
        `INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES ('0000_init', ${Date.now()})`,
      );
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

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      try {
        await db.execute(trimmed);
      } catch (err) {
        if (isAlreadyExistsError(err)) {
          console.warn(
            `[migrate] ${migration.name}: salto sentencia ya aplicada: ${trimmed.slice(0, 80)}...`,
          );
          continue;
        }
        if (
          migration.name === "0006_migrate_monthly_incomes_to_movements" &&
          isMissingTableError(err)
        ) {
          console.warn(
            `[migrate] ${migration.name}: monthly_incomes no existe (BD nueva), salto: ${trimmed.slice(0, 80)}...`,
          );
          continue;
        }
        console.error(
          `[migrate] ${migration.name}: error en sentencia:`,
          trimmed,
          err,
        );
        throw err;
      }
    }

    await db.execute(
      `INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES ('${migration.name}', ${Date.now()})`,
    );

    console.log(`[migrate] Aplicada migracion: ${migration.name}`);
    newlyApplied.push(migration.name);
  }

  return newlyApplied;
}

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
