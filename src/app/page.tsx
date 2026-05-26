"use client";

/**
 * Pantalla de diagnostico del Lote 2.
 *
 * Muestra el estado de la BD:
 *   - Cargando (mientras se inicializa)
 *   - Lista con info: migraciones aplicadas, seed, conteo de filas por tabla
 *   - Error si algo fallo
 *
 * Cuando todo este OK, sera el momento de pasar al Lote 3 (contexto de
 * Settings + pantalla de configuracion real).
 */

import { useEffect, useState } from "react";
import { useDatabase, useDb } from "@/contexts/DatabaseProvider";
import * as schema from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type TableCount = { tabla: string; filas: number };

/**
 * Subcomponente: pide el conteo de filas de cada tabla.
 * Solo se renderiza cuando la BD esta lista (de ahi que useDb() no falle).
 */
function TableCounts() {
  const db = useDb();
  const [counts, setCounts] = useState<TableCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tablas = {
          currencies: schema.currencies,
          settings: schema.settings,
          categories: schema.categories,
          accounts: schema.accounts,
          expenses: schema.expenses,
          monthly_incomes: schema.monthlyIncomes,
          extra_incomes: schema.extraIncomes,
          investments: schema.investments,
          goals: schema.goals,
          mortgage: schema.mortgage,
          other_debts: schema.otherDebts,
          sync_log: schema.syncLog,
        };

        const results: TableCount[] = [];
        for (const [nombre, tabla] of Object.entries(tablas)) {
          const rows = await db
            .select({ count: sql<number>`count(*)` })
            .from(tabla);
          results.push({ tabla: nombre, filas: rows[0]?.count ?? 0 });
        }
        setCounts(results);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [db]);

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Error al contar filas: {error}
      </div>
    );
  }
  if (!counts) {
    return <p className="text-sm text-slate-500">Contando filas...</p>;
  }

  return (
    <table className="w-full max-w-md text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className="py-2 text-left font-medium">Tabla</th>
          <th className="py-2 text-right font-medium">Filas</th>
        </tr>
      </thead>
      <tbody>
        {counts.map((c) => (
          <tr
            key={c.tabla}
            className="border-b border-slate-100 dark:border-slate-800"
          >
            <td className="py-2 font-mono">{c.tabla}</td>
            <td className="py-2 text-right tabular-nums">{c.filas}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HomePage() {
  const status = useDatabase();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Finanzas</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Diagnostico de la base de datos (Lote 2)
        </p>
      </header>

      {status.kind === "loading" && (
        <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="font-medium">Inicializando base de datos...</p>
          <p className="mt-1 text-slate-500">
            Cargando SQLite, aplicando migraciones y ejecutando seed.
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-900 dark:text-red-200">
            Error inicializando la base de datos
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-800 dark:text-red-300">
            {status.error.message}
          </pre>
        </div>
      )}

      {status.kind === "ready" && (
        <>
          <section className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              Base de datos lista
            </p>
            <ul className="mt-2 space-y-1 text-emerald-900 dark:text-emerald-300">
              <li>
                Migraciones aplicadas en este arranque:{" "}
                <strong>
                  {status.migrationsApplied.length === 0
                    ? "ninguna (ya estaban)"
                    : status.migrationsApplied.join(", ")}
                </strong>
              </li>
              <li>
                Monedas insertadas por el seed:{" "}
                <strong>{status.seed.currencies}</strong>
              </li>
              <li>
                Categorias insertadas por el seed:{" "}
                <strong>{status.seed.categories}</strong>
              </li>
              <li>
                Fila de settings creada:{" "}
                <strong>{status.seed.settingsCreated ? "si" : "ya existia"}</strong>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Conteo de filas</h2>
            <TableCounts />
          </section>

          <footer className="mt-auto text-xs text-slate-500">
            Si reinicias la app, los contadores de "monedas insertadas" y
            "categorias insertadas" deberian quedar en 0 (el seed es idempotente)
            y los conteos de filas deberian persistir.
          </footer>
        </>
      )}
    </main>
  );
}
