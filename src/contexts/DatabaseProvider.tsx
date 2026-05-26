"use client";

/**
 * ============================================================================
 *  src/contexts/DatabaseProvider.tsx — Inicializador y proveedor de la BD
 * ============================================================================
 *
 *  Componente que envuelve toda la app. Al montarse:
 *    1. Carga el fichero SQLite via Tauri
 *    2. Aplica las migraciones pendientes
 *    3. Ejecuta el seed (idempotente)
 *    4. Expone el cliente Drizzle al resto via React context
 *
 *  Mientras se inicializa, muestra una pantalla de carga. Si algo falla,
 *  muestra el error en pantalla (mejor que pantalla en blanco).
 *
 *  USO: ya queda envuelto en el RootLayout. En cualquier componente cliente
 *  puedes hacer `const { db, status } = useDatabase()` para acceder a Drizzle.
 * ============================================================================
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { runSeed } from "@/lib/db/seed";
import type { DrizzleDb } from "@/lib/db/proxy-driver";

type Status =
  | { kind: "loading" }
  | {
      kind: "ready";
      db: DrizzleDb;
      migrationsApplied: string[];
      seed: { currencies: number; categories: number; settingsCreated: boolean };
    }
  | { kind: "error"; error: Error };

const DatabaseContext = createContext<Status>({ kind: "loading" });

/**
 * Hook publico: devuelve el estado actual del contexto de BD.
 * En componentes que solo se renderizan cuando la BD ya esta lista,
 * podemos asumir status.kind === 'ready' y desestructurar el `db`.
 */
export function useDatabase(): Status {
  return useContext(DatabaseContext);
}

/**
 * Hook estrecho: devuelve directamente el cliente Drizzle, lanzando si
 * la BD no esta lista. Util en componentes que SOLO se renderizan dentro
 * de DatabaseReady (ver mas abajo).
 */
export function useDb(): DrizzleDb {
  const status = useDatabase();
  if (status.kind !== "ready") {
    throw new Error(
      "useDb llamado antes de que la BD este lista. Envuelve en <DatabaseReady>.",
    );
  }
  return status.db;
}

/**
 * Provider que se monta una sola vez en RootLayout.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Importante: getDb() es idempotente, asi que aunque el efecto
        // se ejecute dos veces en dev (StrictMode), la conexion se abre
        // una sola vez.
        const db = await getDb();
        const migrationsApplied = await runMigrations();
        const seed = await runSeed();

        if (!cancelled) {
          setStatus({ kind: "ready", db, migrationsApplied, seed });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={status}>
      {children}
    </DatabaseContext.Provider>
  );
}
