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
 *    4. Crea los repositorios sobre la conexion
 *    5. Expone {db, repos} al resto via React context
 *
 *  Mientras se inicializa, muestra una pantalla de carga. Si algo falla,
 *  muestra el error en pantalla.
 *
 *  HOOKS PUBLICOS QUE EXPONE
 *  -------------------------
 *    - useDatabase():  status completo (loading | ready | error)
 *    - useDb():        cliente Drizzle (lanza si no esta ready)
 *    - useRepos():     bolsa de repositorios (lanza si no esta ready)
 *
 *  Los hooks useDb/useRepos asumen que solo se llaman desde componentes
 *  hijos de un <DatabaseReady> (que solo renderiza cuando todo esta listo).
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
import { createRepositories, type Repositories } from "@/lib/repositories";
import { RecurringService } from "@/lib/services/recurring-service";
import { toast } from "sonner";

type Status =
  | { kind: "loading" }
  | {
      kind: "ready";
      db: DrizzleDb;
      repos: Repositories;
      migrationsApplied: string[];
      seed: {
        currencies: number;
        categories: number;
        settingsCreated: boolean;
      };
    }
  | { kind: "error"; error: Error };

const DatabaseContext = createContext<Status>({ kind: "loading" });

export function useDatabase(): Status {
  return useContext(DatabaseContext);
}

export function useDb(): DrizzleDb {
  const status = useDatabase();
  if (status.kind !== "ready") {
    throw new Error("useDb llamado antes de que la BD este lista.");
  }
  return status.db;
}

export function useRepos(): Repositories {
  const status = useDatabase();
  if (status.kind !== "ready") {
    throw new Error("useRepos llamado antes de que la BD este lista.");
  }
  return status.repos;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await getDb();
        const migrationsApplied = await runMigrations();
        const seed = await runSeed();
        const repos = createRepositories(db);

        // [Lote 11b] Generar movimientos recurrentes pendientes
        try {
          const recurringService = new RecurringService(db);
          const result =
            await recurringService.generatePendingUpToCurrentMonth();
          if (result.generated.length > 0) {
            console.log(
              `[recurring] Generados ${result.generated.length} movimientos automaticos ` +
                `(skipped: ${result.skippedExisting})`,
            );
            // Opcional: toast informativo
            toast.info(
              `Generados ${result.generated.length} movimientos recurrentes`,
            );
          }
        } catch (err) {
          // No bloquear el arranque por esto. Lo logueamos y seguimos.
          console.error("[recurring] Error generando movimientos:", err);
        }

        if (!cancelled) {
          setStatus({
            kind: "ready",
            db,
            repos,
            migrationsApplied,
            seed,
          });
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

/**
 * Componente que solo renderiza sus hijos cuando la BD esta lista.
 * Util para envolver paginas/layouts que necesitan acceso a datos.
 * Muestra fallbacks de loading y error automaticamente.
 */
export function DatabaseReady({ children }: { children: ReactNode }) {
  const status = useDatabase();

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Inicializando base de datos...
        </p>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">
            Error inicializando la base de datos
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-destructive/80">
            {status.error.message}
          </pre>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
