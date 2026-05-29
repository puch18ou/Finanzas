/**
 * ============================================================================
 *  src/lib/auth/registry.ts — Registro de usuarios de la plataforma
 * ============================================================================
 *
 *  Vive en un fichero SQLite APARTE (`_users.db`), independiente de la BD de
 *  finanzas de cada usuario. Guarda la lista de usuarios, su PIN hasheado y su
 *  rol. Cada usuario "normal" apunta a su propio fichero de datos (`db_file`);
 *  el usuario admin no tiene finanzas (`db_file = NULL`).
 *
 *  Aislamiento de datos = una BD por usuario. Aqui solo gestionamos el acceso.
 *
 *  Bootstrap (primer arranque, si no hay usuarios): se crea un `admin`
 *  (PIN 0000, sin finanzas, debe cambiar PIN) para poder gestionar usuarios.
 *  El resto de usuarios se crean desde la consola admin (o autorregistro).
 * ============================================================================
 */

import Database from "@tauri-apps/plugin-sql";
import { hashPin, validatePinFormat, verifyPin } from "./pin";

const REGISTRY_PATH = "sqlite:_users.db";

export type UserRole = "user" | "admin";

/** Usuario tal y como lo consume la app (sin datos sensibles). */
export type User = {
  id: string;
  username: string;
  role: UserRole;
  dbFile: string | null;
  mustChangePin: boolean;
  createdAt: number;
  updatedAt: number;
};

type UserRow = {
  id: string;
  username: string;
  pin_hash: string;
  pin_salt: string;
  role: string;
  db_file: string | null;
  must_change_pin: number;
  created_at: number;
  updated_at: number;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role === "admin" ? "admin" : "user",
    dbFile: row.db_file,
    mustChangePin: row.must_change_pin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let _registry: Database | null = null;
let _initPromise: Promise<Database> | null = null;

/** Carga (una sola vez) el registro, crea la tabla y ejecuta el bootstrap. */
async function getRegistry(): Promise<Database> {
  if (_registry) return _registry;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const db = await Database.load(REGISTRY_PATH);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        db_file TEXT,
        must_change_pin INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    await bootstrap(db);
    _registry = db;
    return db;
  })();

  return _initPromise;
}

/**
 * Garantiza que existan los usuarios semilla. Idempotente y AUTORREPARABLE:
 * comprueba cada usuario por separado, de modo que un registro a medias (p.ej.
 * solo puch18ou) se completa en el siguiente arranque sin duplicar nada.
 */
async function bootstrap(db: Database): Promise<void> {
  await ensureSeedUser(db, {
    username: "admin",
    pin: "0000",
    role: "admin",
    dbFile: null,
    mustChangePin: true,
  });
}

async function ensureSeedUser(
  db: Database,
  seed: {
    username: string;
    pin: string;
    role: UserRole;
    dbFile: string | null;
    mustChangePin: boolean;
  },
): Promise<void> {
  if (await getRowByUsername(db, seed.username)) return;
  await insertUser(db, { id: crypto.randomUUID(), ...seed });
}

async function insertUser(
  db: Database,
  args: {
    id: string;
    username: string;
    pin: string;
    role: UserRole;
    dbFile: string | null;
    mustChangePin: boolean;
  },
): Promise<User> {
  const { hash, salt } = await hashPin(args.pin);
  const now = Date.now();

  await db.execute(
    `INSERT INTO users
       (id, username, pin_hash, pin_salt, role, db_file, must_change_pin, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      args.id,
      args.username,
      hash,
      salt,
      args.role,
      args.dbFile,
      args.mustChangePin ? 1 : 0,
      now,
      now,
    ],
  );

  return {
    id: args.id,
    username: args.username,
    role: args.role,
    dbFile: args.dbFile,
    mustChangePin: args.mustChangePin,
    createdAt: now,
    updatedAt: now,
  };
}

/** Lista todos los usuarios (sin datos sensibles), ordenados por nombre. */
export async function listUsers(): Promise<User[]> {
  const db = await getRegistry();
  const rows = await db.select<UserRow[]>(
    `SELECT * FROM users ORDER BY role DESC, username ASC`,
  );
  return rows.map(toUser);
}

async function getRowByUsername(
  db: Database,
  username: string,
): Promise<UserRow | null> {
  const rows = await db.select<UserRow[]>(
    `SELECT * FROM users WHERE username = $1 LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

/** Comprueba username + PIN. Devuelve el usuario si coincide, o null. */
export async function verifyLogin(
  username: string,
  pin: string,
): Promise<User | null> {
  const db = await getRegistry();
  const row = await getRowByUsername(db, username);
  if (!row) return null;
  const ok = await verifyPin(pin, row.pin_hash, row.pin_salt);
  return ok ? toUser(row) : null;
}

/**
 * Crea un usuario nuevo. El admin no tiene BD de finanzas; un usuario normal
 * apunta a un fichero propio `user_<id>.db` que se crea al abrirse por primera vez.
 */
export async function createUser(args: {
  username: string;
  pin: string;
  role?: UserRole;
  mustChangePin?: boolean;
}): Promise<User> {
  const username = args.username.trim();
  if (username.length === 0) {
    throw new Error("El nombre de usuario no puede estar vacio.");
  }
  if (!validatePinFormat(args.pin)) {
    throw new Error("El PIN debe tener entre 4 y 8 digitos.");
  }

  const db = await getRegistry();
  if (await getRowByUsername(db, username)) {
    throw new Error(`El usuario "${username}" ya existe.`);
  }

  const role: UserRole = args.role ?? "user";
  const id = crypto.randomUUID();
  const dbFile = role === "admin" ? null : `user_${id}.db`;

  return insertUser(db, {
    id,
    username,
    pin: args.pin,
    role,
    dbFile,
    mustChangePin: args.mustChangePin ?? false,
  });
}

/**
 * Cambia el PIN de un usuario.
 * - Cambio propio (forceChange=false): limpia el flag must_change_pin.
 * - Reseteo del admin (forceChange=true): marca must_change_pin para que el
 *   usuario lo cambie por uno suyo en el siguiente inicio de sesion.
 */
export async function updatePin(
  id: string,
  newPin: string,
  opts?: { forceChange?: boolean },
): Promise<void> {
  if (!validatePinFormat(newPin)) {
    throw new Error("El PIN debe tener entre 4 y 8 digitos.");
  }
  const db = await getRegistry();
  const { hash, salt } = await hashPin(newPin);
  await db.execute(
    `UPDATE users
       SET pin_hash = $1, pin_salt = $2, must_change_pin = $3, updated_at = $4
     WHERE id = $5`,
    [hash, salt, opts?.forceChange ? 1 : 0, Date.now(), id],
  );
}

/**
 * Borra un usuario del registro (le quita el acceso). NO borra su fichero de
 * datos del disco: queda huerfano. Decision de v1 para no depender del plugin fs.
 */
export async function deleteUser(id: string): Promise<void> {
  const db = await getRegistry();
  await db.execute(`DELETE FROM users WHERE id = $1`, [id]);
}
