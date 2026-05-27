/**
 * src/lib/services/backup-service.ts
 *
 * Lote 10a-3: el backup ya no exporta monthly_incomes. Se mantiene
 * la version 2 del formato. Los backups v2 anteriores que tenian
 * monthlyIncomes simplemente ignoraran ese campo al importar.
 *
 * Los v1 (con expenses + extraIncomes) siguen siendo importables.
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  currencies,
  settings,
  categories,
  accounts,
  investments,
  goals,
  mortgage,
  otherDebts,
  movements,
} from "@/lib/db/schema";

const BACKUP_VERSION = 2;
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
    investments: unknown[];
    goals: unknown[];
    mortgage: unknown[];
    otherDebts: unknown[];
    movements: unknown[];
    // Compatibilidad con formatos anteriores (ignorados al importar)
    monthlyIncomes?: unknown[];
    expenses?: unknown[];
    extraIncomes?: unknown[];
  };
};

export class BackupService {
  constructor(private db: DrizzleDb) {}

  async exportAll(): Promise<BackupFile> {
    const [
      curs, sets, cats, accs, invs, gls, mort, debts, movs,
    ] = await Promise.all([
      this.db.select().from(currencies),
      this.db.select().from(settings),
      this.db.select().from(categories),
      this.db.select().from(accounts),
      this.db.select().from(investments),
      this.db.select().from(goals),
      this.db.select().from(mortgage),
      this.db.select().from(otherDebts),
      this.db.select().from(movements),
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
        investments: invs,
        goals: gls,
        mortgage: mort,
        otherDebts: debts,
        movements: movs,
      },
    };
  }

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
    if (b.version >= 2) {
      if (!Array.isArray((b.data as Record<string, unknown>).movements)) {
        throw new Error(`El archivo v${b.version} requiere 'data.movements'.`);
      }
    } else {
      if (
        !Array.isArray((b.data as Record<string, unknown>).expenses) ||
        !Array.isArray((b.data as Record<string, unknown>).extraIncomes)
      ) {
        throw new Error(
          `El archivo v1 requiere 'data.expenses' y 'data.extraIncomes'.`,
        );
      }
    }
  }

  async importAll(backup: BackupFile): Promise<void> {
    this.validateBackup(backup);

    const convert = (rows: unknown[]): unknown[] =>
      rows.map((row) => this.convertDates(row));

    // Vaciar en orden inverso de dependencias
    await this.db.delete(movements);
    await this.db.delete(investments);
    await this.db.delete(goals);
    await this.db.delete(otherDebts);
    await this.db.delete(mortgage);
    await this.db.delete(accounts);
    await this.db.delete(categories);
    await this.db.delete(settings);
    await this.db.delete(currencies);

    // Reinsertar padres primero
    await this.insertBatch(currencies, convert(backup.data.currencies));
    await this.insertBatch(settings, convert(backup.data.settings));
    await this.insertBatch(categories, convert(backup.data.categories));
    await this.insertBatch(accounts, convert(backup.data.accounts));
    await this.insertBatch(investments, convert(backup.data.investments));
    await this.insertBatch(goals, convert(backup.data.goals));
    await this.insertBatch(mortgage, convert(backup.data.mortgage));
    await this.insertBatch(otherDebts, convert(backup.data.otherDebts));

    // Movements: v2 directo; v1 convierte expenses + extraIncomes
    if (backup.version >= 2 && backup.data.movements) {
      await this.insertBatch(movements, convert(backup.data.movements));
    } else {
      const exps = (backup.data.expenses ?? []) as Array<Record<string, unknown>>;
      const extras = (backup.data.extraIncomes ?? []) as Array<Record<string, unknown>>;

      const movFromExp = exps.map((e) => ({
        id: e.id,
        tipo: "gasto" as const,
        fecha: e.fecha,
        concepto: e.concepto,
        importe: e.importe,
        moneda: e.moneda,
        cuentaOrigenId: e.cuentaId ?? null,
        cuentaDestinoId: null,
        categoriaId: e.categoriaId,
        categoriaTexto: null,
        mes: e.mes,
        anio: e.anio,
        notas: e.notas ?? null,
        esAutomatico: false,
        origenAutomatico: null,
        origenAutomaticoId: null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        deletedAt: e.deletedAt ?? null,
      }));

      const movFromExtra = extras.map((e) => ({
        id: e.id,
        tipo: "ingreso" as const,
        fecha: e.fecha,
        concepto: e.concepto,
        importe: e.importe,
        moneda: e.moneda,
        cuentaOrigenId: null,
        cuentaDestinoId: null,
        categoriaId: null,
        categoriaTexto: e.categoria ?? null,
        mes: e.mes,
        anio: e.anio,
        notas: e.notas ?? null,
        esAutomatico: false,
        origenAutomatico: null,
        origenAutomaticoId: null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        deletedAt: e.deletedAt ?? null,
      }));

      await this.insertBatch(movements, convert([...movFromExp, ...movFromExtra]));
    }
    // monthlyIncomes en backups antiguos: IGNORADO (tabla deprecated en uso)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async insertBatch(table: any, rows: unknown[]): Promise<void> {
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db.insert(table).values(row as any);
    }
  }

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

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
