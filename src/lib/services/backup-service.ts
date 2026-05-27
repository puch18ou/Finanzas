/**
 * ============================================================================
 *  src/lib/services/backup-service.ts
 * ============================================================================
 *
 *  Export / import del JSON completo de la BD.
 *
 *  FORMATO DEL JSON
 *  ----------------
 *  {
 *    "version": 1,
 *    "exportedAt": "2026-05-27T10:23:45.000Z",
 *    "app": "finanzas",
 *    "data": {
 *      "currencies": [...],
 *      "settings": [...],
 *      "categories": [...],
 *      ...
 *    }
 *  }
 *
 *  Las fechas se serializan como ISO strings (gracias a Date.prototype.toJSON).
 *  Al importar las parseamos de vuelta a Date.
 *
 *  IMPORTACION
 *  -----------
 *  La importacion BORRA todos los datos actuales (DELETE FROM todas las
 *  tablas, ignorando soft-delete) y reinserta los del archivo. Es la
 *  estrategia mas simple y robusta para garantizar consistencia.
 *
 *  Las tablas se borran/insertan en orden inverso/directo de dependencias
 *  para respetar las foreign keys.
 *
 *  La tabla _migrations NO se exporta ni se toca al importar: queda como
 *  esta en la BD destino.
 * ============================================================================
 */

import { sql } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  currencies,
  settings,
  categories,
  accounts,
  expenses,
  monthlyIncomes,
  extraIncomes,
  investments,
  goals,
  mortgage,
  otherDebts,
} from "@/lib/db/schema";

const BACKUP_VERSION = 1;
const APP_ID = "finanzas";

export type BackupFile = {
  version: number;
  exportedAt: string;
  app: string;
  data: {
    currencies: unknown[];
    settings: unknown[];
    categories: unknown[];
    accounts: unknown[];
    expenses: unknown[];
    monthlyIncomes: unknown[];
    extraIncomes: unknown[];
    investments: unknown[];
    goals: unknown[];
    mortgage: unknown[];
    otherDebts: unknown[];
  };
};

export class BackupService {
  constructor(private db: DrizzleDb) {}

  /**
   * Exporta toda la BD a un objeto JSON serializable.
   */
  async exportAll(): Promise<BackupFile> {
    const [
      curs,
      sets,
      cats,
      accs,
      exps,
      mInc,
      eInc,
      invs,
      gls,
      mort,
      debts,
    ] = await Promise.all([
      this.db.select().from(currencies),
      this.db.select().from(settings),
      this.db.select().from(categories),
      this.db.select().from(accounts),
      this.db.select().from(expenses),
      this.db.select().from(monthlyIncomes),
      this.db.select().from(extraIncomes),
      this.db.select().from(investments),
      this.db.select().from(goals),
      this.db.select().from(mortgage),
      this.db.select().from(otherDebts),
    ]);

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: APP_ID,
      data: {
        currencies: curs,
        settings: sets,
        categories: cats,
        accounts: accs,
        expenses: exps,
        monthlyIncomes: mInc,
        extraIncomes: eInc,
        investments: invs,
        goals: gls,
        mortgage: mort,
        otherDebts: debts,
      },
    };
  }

  /**
   * Valida que el archivo tenga el formato esperado.
   * Lanza Error con mensaje legible si no es valido.
   */
  validateBackup(obj: unknown): asserts obj is BackupFile {
    if (!obj || typeof obj !== "object") {
      throw new Error("El archivo no es un JSON valido.");
    }
    const b = obj as Partial<BackupFile>;
    if (b.app !== APP_ID) {
      throw new Error(
        `El archivo no es un backup de Finanzas (app="${b.app}").`,
      );
    }
    if (typeof b.version !== "number") {
      throw new Error("El archivo no tiene un numero de version valido.");
    }
    if (b.version > BACKUP_VERSION) {
      throw new Error(
        `Version del backup (${b.version}) mas nueva que la soportada (${BACKUP_VERSION}). Actualiza la app.`,
      );
    }
    if (!b.data || typeof b.data !== "object") {
      throw new Error("El archivo no contiene una seccion 'data' valida.");
    }
    const required = [
      "currencies",
      "settings",
      "categories",
      "accounts",
      "expenses",
      "monthlyIncomes",
      "extraIncomes",
      "investments",
      "goals",
      "mortgage",
      "otherDebts",
    ] as const;
    for (const key of required) {
      const arr = (b.data as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) {
        throw new Error(`El archivo no contiene 'data.${key}' como array.`);
      }
    }
  }

  /**
   * Importa el backup: borra todos los datos actuales y reinserta los del
   * archivo. Sin confirmacion (la pide la UI).
   *
   * Las tablas se vacian en ORDEN INVERSO de dependencias para respetar
   * las FKs (las hijas primero, las padres despues). Y se reinsertan en
   * orden DIRECTO.
   */
  async importAll(backup: BackupFile): Promise<void> {
    this.validateBackup(backup);

    // Convertir fechas ISO de vuelta a Date en los registros
    const convert = (rows: unknown[]): unknown[] =>
      rows.map((row) => this.convertDates(row));

    // 1. Vaciar en orden INVERSO (hijos primero)
    //    expenses, extraIncomes, investments, goals, otherDebts, mortgage
    //    todas dependen de categories/accounts/currencies → se borran antes
    //    que sus padres
    await this.db.delete(expenses);
    await this.db.delete(extraIncomes);
    await this.db.delete(investments);
    await this.db.delete(goals);
    await this.db.delete(otherDebts);
    await this.db.delete(mortgage);
    await this.db.delete(monthlyIncomes);
    await this.db.delete(accounts);
    await this.db.delete(categories);
    await this.db.delete(settings);
    await this.db.delete(currencies);

    // 2. Reinsertar en orden DIRECTO (padres primero)
    await this.insertBatch(currencies, convert(backup.data.currencies));
    await this.insertBatch(settings, convert(backup.data.settings));
    await this.insertBatch(categories, convert(backup.data.categories));
    await this.insertBatch(accounts, convert(backup.data.accounts));
    await this.insertBatch(monthlyIncomes, convert(backup.data.monthlyIncomes));
    await this.insertBatch(expenses, convert(backup.data.expenses));
    await this.insertBatch(extraIncomes, convert(backup.data.extraIncomes));
    await this.insertBatch(investments, convert(backup.data.investments));
    await this.insertBatch(goals, convert(backup.data.goals));
    await this.insertBatch(mortgage, convert(backup.data.mortgage));
    await this.insertBatch(otherDebts, convert(backup.data.otherDebts));
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /**
   * Inserta filas una a una (mas seguro que insert masivo con tipos
   * mixtos). Si una fila esta corrupta, el error indica cual.
   *
   * No usamos Drizzle's bulk insert porque el typing es restrictivo y
   * aqui aceptamos `unknown` (validacion ya hecha por validateBackup).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async insertBatch(table: any, rows: unknown[]): Promise<void> {
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db.insert(table).values(row as any);
    }
  }

  /**
   * Convierte campos que parecen fechas ISO a Date. Drizzle espera Date
   * en columnas con mode: 'timestamp_ms', y el JSON las trae como string.
   *
   * Detectamos por nombre de campo: cualquier campo terminado en 'At' o
   * que se llame 'fecha*' o 'fechaInicio' / 'fechaCompra' / 'fechaObjetivo'.
   */
  private convertDates(row: unknown): unknown {
    if (!row || typeof row !== "object") return row;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      const looksLikeDateField =
        k === "createdAt" ||
        k === "updatedAt" ||
        k === "deletedAt" ||
        k.startsWith("fecha");
      if (looksLikeDateField && typeof v === "string") {
        const d = new Date(v);
        result[k] = isNaN(d.getTime()) ? v : d;
      } else {
        result[k] = v;
      }
    }
    return result;
  }
}

/**
 * Helper: dispara la descarga de un archivo JSON en el navegador.
 * Funciona dentro de Tauri (que es un Chromium embebido).
 */
export function downloadJson(filename: string, data: unknown): void {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper: lee un archivo seleccionado por el usuario y lo parsea como JSON.
 */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        resolve(JSON.parse(text));
      } catch (e) {
        reject(new Error(`Archivo no es JSON valido: ${e instanceof Error ? e.message : "error"}`));
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo el archivo"));
    reader.readAsText(file);
  });
}
