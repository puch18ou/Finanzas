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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb, getRawDb, setActiveDbPath } from "@/lib/db/client";
import { useAuth } from "@/contexts/AuthProvider";
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

// ---------------------------------------------------------------------------
//  Control del MODO DEMO: abre una BD de ejemplo aparte (sandbox) y vuelve.
// ---------------------------------------------------------------------------

const DEMO_DB_FILE = "finanzas_demo.db";

// Bandera SINCRONA de "demo en curso". Existe ademas del estado React
// (demoActive) porque hay codigo no-React que necesita saberlo de inmediato,
// sin esperar a un re-render: sobre todo el listener del servidor de sync, que
// NO debe tocar ninguna BD mientras la de ejemplo esta activa. La activamos
// ANTES de cambiar de BD y la desactivamos DESPUES de volver a la real, para
// que no quede ninguna ventana en la que se pueda escribir en la BD equivocada.
let _demoModeActive = false;
export function isDemoModeActive(): boolean {
  return _demoModeActive;
}

type DbControl = {
  demoActive: boolean;
  /** Entra en la BD de ejemplo (fresca). No toca tus datos reales. */
  enterDemoMode: () => Promise<void>;
  /** Vuelve a tu BD real. */
  exitDemoMode: () => Promise<void>;
};

const DbControlContext = createContext<DbControl | null>(null);

export function useDbControl(): DbControl {
  const ctx = useContext(DbControlContext);
  if (!ctx) {
    return {
      demoActive: false,
      enterDemoMode: async () => {},
      exitDemoMode: async () => {},
    };
  }
  return ctx;
}

/** Vacia los datos de usuario de la BD demo (deja categorias/monedas/settings
 *  del seed) para que cada demo empiece fresco. Se llama con la BD demo activa. */
async function resetDemoDb(): Promise<void> {
  const raw = await getRawDb();
  // Orden respetando FKs: primero lo que referencia a cuentas/categorias.
  const tables = [
    "movements",
    "recurring_rules",
    "investment_contributions",
    "investments",
    "goals",
    "mortgage",
    "other_debts",
    "presupuesto_tramos",
    "objetivo_ahorro_tramos",
    "patrimonio_snapshots",
    "tombstones",
    "sync_state",
    "accounts",
  ];
  for (const t of tables) {
    try {
      await raw.execute(`DELETE FROM ${t}`);
    } catch {
      /* tabla inexistente o vacia: ignorar */
    }
  }
  // Presupuestos de categoria a 0 (el demo los editara y asi cada run parte igual).
  try {
    await raw.execute("UPDATE categories SET presupuesto_mensual = 0");
  } catch {
    /* ignorar */
  }
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

type InitResult = {
  db: DrizzleDb;
  repos: Repositories;
  migrationsApplied: string[];
  seed: { currencies: number; categories: number; settingsCreated: boolean };
};

// Dedup de la inicializacion: en dev, React StrictMode monta el provider dos
// veces y, sobre una BD recien creada, dos pasadas de migraciones/seed corren
// a la vez y chocan (UNIQUE en _migrations, PK en currencies...). Compartimos
// la promesa en vuelo para que la inicializacion ocurra UNA sola vez por BD.
let _initPromise: Promise<InitResult> | null = null;
let _initPath: string | null = null;

async function initDatabaseForUser(dbFile: string): Promise<InitResult> {
  const path = `sqlite:${dbFile}`;
  setActiveDbPath(path);

  if (_initPromise && _initPath === path) return _initPromise;

  _initPath = path;
  _initPromise = (async () => {
    const db = await getDb();
    const migrationsApplied = await runMigrations();
    const seed = await runSeed();
    const repos = createRepositories(db);

    // [Lote 11b] Generar movimientos recurrentes pendientes
    try {
      const recurringService = new RecurringService(db);
      const result = await recurringService.generatePendingUpToCurrentMonth();
      if (result.generated.length > 0) {
        console.log(
          `[recurring] Generados ${result.generated.length} movimientos automaticos ` +
            `(skipped: ${result.skippedExisting})`,
        );
        toast.info(
          `Generados ${result.generated.length} movimientos recurrentes`,
        );
      }
    } catch (err) {
      // No bloquear el arranque por esto. Lo logueamos y seguimos.
      console.error("[recurring] Error generando movimientos:", err);
    }

    // [Lote 13b-2] Generar aportaciones periodicas pendientes a inversiones.
    try {
      const periodicas =
        await repos.investmentContributionService.generatePeriodicContributions();
      if (periodicas > 0) {
        console.log(`[recurring] Generadas ${periodicas} aportaciones periodicas`);
        toast.info(`Generadas ${periodicas} aportaciones periodicas`);
      }
    } catch (err) {
      console.error("[recurring] Error generando aportaciones periodicas:", err);
    }

    // [Lote 16] Aplicar intereses pendientes a inversiones con TAE configurada.
    try {
      const result =
        await repos.investmentInterestService.applyPendingInterest();
      if (result.inversionesActualizadas > 0) {
        console.log(
          `[interest] Intereses aplicados a ${result.inversionesActualizadas} ` +
            `inversiones (${result.periodosAplicados} periodos en total)`,
        );
        toast.info(
          `Intereses aplicados a ${result.inversionesActualizadas} inversiones`,
        );
      }
    } catch (err) {
      console.error("[interest] Error aplicando intereses:", err);
    }

    return { db, repos, migrationsApplied, seed };
  })();

  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [demoActive, setDemoActive] = useState(false);
  const demoRef = useRef(false);
  const qc = useQueryClient();
  // Multiusuario: cada usuario tiene su propio fichero .db (Lote 12).
  const { user } = useAuth();
  const dbFile = user?.dbFile ?? null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!dbFile) {
          throw new Error("No hay fichero de BD para el usuario en sesion.");
        }
        // Si estamos en demo, no reinicializamos por este efecto.
        if (demoRef.current) return;
        const { db, repos, migrationsApplied, seed } =
          await initDatabaseForUser(dbFile);
        if (!cancelled && !demoRef.current) {
          setStatus({ kind: "ready", db, repos, migrationsApplied, seed });
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
  }, [dbFile]);

  const enterDemoMode = useCallback(async () => {
    // Activamos las banderas ANTES de cambiar de BD: asi el servidor de sync y
    // demas ya saben que estamos en demo antes de que la BD de ejemplo pase a
    // ser la activa (no hay ventana para escribir datos reales en la de ejemplo).
    _demoModeActive = true;
    demoRef.current = true;
    // NO ponemos loading: mantenemos la BD real montada hasta que la demo este
    // lista (evita desmontar la app / el propio motor del demo).
    const r = await initDatabaseForUser(DEMO_DB_FILE);
    await resetDemoDb();
    setStatus({
      kind: "ready",
      db: r.db,
      repos: r.repos,
      migrationsApplied: r.migrationsApplied,
      seed: r.seed,
    });
    setDemoActive(true);
    // OJO: NO invalidamos aqui. Si lo hicieramos ahora, React aun no ha aplicado
    // el nuevo status, asi que las queries montadas refrescarian con los repos
    // ANTERIORES (la BD real) y verias datos reales dentro del demo. La
    // invalidacion la hace un efecto post-render segun cambia la instancia de BD.
  }, []);

  const exitDemoMode = useCallback(async () => {
    if (!dbFile) {
      // Sin BD real a la que volver: al menos salimos del modo demo.
      _demoModeActive = false;
      demoRef.current = false;
      setDemoActive(false);
      return;
    }
    // Primero volvemos a la BD real; la bandera sincrona sigue activa durante el
    // cambio para que nada de sync toque BD hasta que estemos de vuelta.
    const r = await initDatabaseForUser(dbFile);
    demoRef.current = false;
    setStatus({
      kind: "ready",
      db: r.db,
      repos: r.repos,
      migrationsApplied: r.migrationsApplied,
      seed: r.seed,
    });
    _demoModeActive = false;
    setDemoActive(false);
    // Igual que al entrar: la invalidacion la dispara el efecto post-render.
  }, [dbFile]);

  // Cada vez que la INSTANCIA de BD lista cambia (arranque, entrar al demo,
  // salir del demo) invalidamos TODAS las queries. Al ser un efecto, corre
  // DESPUES de que React haya aplicado el nuevo status: para entonces las
  // queries montadas ya cierran sobre los repos correctos, asi que el refetch
  // lee de la BD adecuada (real o de ejemplo).
  const readyDb = status.kind === "ready" ? status.db : null;
  useEffect(() => {
    if (readyDb) void qc.invalidateQueries();
  }, [readyDb, qc]);

  const control = useMemo<DbControl>(
    () => ({ demoActive, enterDemoMode, exitDemoMode }),
    [demoActive, enterDemoMode, exitDemoMode],
  );

  return (
    <DbControlContext.Provider value={control}>
      <DatabaseContext.Provider value={status}>
        {children}
      </DatabaseContext.Provider>
    </DbControlContext.Provider>
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
