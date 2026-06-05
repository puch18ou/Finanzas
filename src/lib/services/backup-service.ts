/**
 * src/lib/services/backup-service.ts
 *
 * Lote 10b: formato v3. El campo `saldo` de las cuentas pasa a
 * `saldoInicial` (saldo de partida). Al importar un backup v1/v2 (que
 * tenia `saldo` = saldo actual manual), recalculamos saldoInicial
 * restandole el impacto neto de los movimientos, igual que la migracion
 * 0008, para que el saldo mostrado no cambie.
 *
 * Lote 10a-3: el backup ya no exporta monthly_incomes. Los v1 (con
 * expenses + extraIncomes) siguen siendo importables.
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  currencies,
  settings,
  categories,
  accounts,
  investments,
  investmentContributions,
  goals,
  mortgage,
  otherDebts,
  movements,
  objetivoAhorroTramos,
  presupuestoTramos,
} from "@/lib/db/schema";
import { computeNetImpactByAccount } from "@/lib/domain/accounts";
import { buildRatesMap } from "@/lib/domain/currency";
import type { Currency } from "@/lib/db/schema";

const BACKUP_VERSION = 6;
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
    // v4: aportaciones de inversiones. Ausente en backups v<=3.
    investmentContributions?: unknown[];
    // v5: tramos del objetivo de ahorro. Ausente en backups v<=4 (se
    // reconstruyen desde settings al importar).
    objetivoAhorroTramos?: unknown[];
    // v6: cambios de presupuesto por categoria. Ausente en backups v<=5 (el
    // presupuesto base vive en categories, asi que no hace falta reconstruir).
    presupuestoTramos?: unknown[];
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
      curs, sets, cats, accs, invs, invContribs, gls, mort, debts, movs,
      objTramos, presTramos,
    ] = await Promise.all([
      this.db.select().from(currencies),
      this.db.select().from(settings),
      this.db.select().from(categories),
      this.db.select().from(accounts),
      this.db.select().from(investments),
      this.db.select().from(investmentContributions),
      this.db.select().from(goals),
      this.db.select().from(mortgage),
      this.db.select().from(otherDebts),
      this.db.select().from(movements),
      this.db.select().from(objetivoAhorroTramos),
      this.db.select().from(presupuestoTramos),
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
        investmentContributions: invContribs,
        goals: gls,
        mortgage: mort,
        otherDebts: debts,
        movements: movs,
        objetivoAhorroTramos: objTramos,
        presupuestoTramos: presTramos,
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

    // 1. Determinar el conjunto final de movements (v2/v3 directo; v1 los
    //    construye desde expenses + extraIncomes). Los necesitamos ANTES de
    //    insertar cuentas para poder recalcular saldoInicial en backups
    //    antiguos.
    let movRows: Array<Record<string, unknown>>;
    if (backup.version >= 2 && backup.data.movements) {
      movRows = backup.data.movements as Array<Record<string, unknown>>;
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

      movRows = [...movFromExp, ...movFromExtra];
    }

    // 2. Cuentas: en backups < v3 el campo era `saldo` (saldo actual). Lo
    //    convertimos a `saldoInicial` restando el impacto neto de los
    //    movimientos, para que el saldo calculado coincida con el que
    //    mostraba el backup.
    const accountRows = this.normalizeAccountRows(
      backup.data.accounts as Array<Record<string, unknown>>,
      movRows,
      backup.data.currencies as Array<Record<string, unknown>>,
      backup.version,
    );

    // Vaciar en orden inverso de dependencias
    await this.db.delete(objetivoAhorroTramos);
    await this.db.delete(presupuestoTramos);
    await this.db.delete(investmentContributions);
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
    await this.insertBatch(accounts, convert(accountRows));
    await this.insertBatch(investments, convert(backup.data.investments));
    await this.insertBatch(goals, convert(backup.data.goals));
    await this.insertBatch(mortgage, convert(backup.data.mortgage));
    await this.insertBatch(otherDebts, convert(backup.data.otherDebts));

    await this.insertBatch(movements, convert(movRows));

    // Aportaciones de inversiones: v4 trae el array. Backups v<=3 no lo tienen,
    // asi que sembramos una aportacion inicial por inversion (como la migracion
    // 0010) para que el historial sea coherente.
    const contribRows =
      backup.version >= 4 && backup.data.investmentContributions
        ? (backup.data.investmentContributions as Array<Record<string, unknown>>)
        : this.seedContributionsFromInvestments(
            backup.data.investments as Array<Record<string, unknown>>,
          );
    await this.insertBatch(investmentContributions, convert(contribRows));

    // Tramos del objetivo de ahorro: v5 trae el array. En backups v<=4 los
    // reconstruimos desde la fila de settings importada (como hace el seed).
    const tramoRows =
      backup.version >= 5 && backup.data.objetivoAhorroTramos
        ? (backup.data.objetivoAhorroTramos as Array<Record<string, unknown>>)
        : this.seedObjetivoTramosFromSettings(
            backup.data.settings as Array<Record<string, unknown>>,
          );
    await this.insertBatch(objetivoAhorroTramos, convert(tramoRows));

    // Cambios de presupuesto por categoria: v6 trae el array. En backups v<=5
    // no existe (el presupuesto base ya esta en categories), asi que se queda
    // vacio.
    if (backup.version >= 6 && backup.data.presupuestoTramos) {
      await this.insertBatch(
        presupuestoTramos,
        convert(backup.data.presupuestoTramos as Array<Record<string, unknown>>),
      );
    }
    // monthlyIncomes en backups antiguos: IGNORADO (tabla deprecated en uso)
  }

  /**
   * Reconstruye el tramo base del objetivo de ahorro desde la fila de settings
   * (para importar backups v<=4 que aun no tenian tramos). Mismo criterio que
   * el seed: un unico tramo con el pct/importe de settings y `desde` = el mes
   * de objetivo_ahorro_desde (o null = "desde siempre").
   */
  private seedObjetivoTramosFromSettings(
    settingsRows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const s = settingsRows[0];
    if (!s) return [];
    const pct = typeof s.objetivoAhorroPct === "number" ? s.objetivoAhorroPct : 0;
    const importe =
      typeof s.objetivoAhorroImporte === "number" ? s.objetivoAhorroImporte : 0;
    if (pct <= 0 && importe <= 0) return [];

    const rawDesde = s.objetivoAhorroDesde;
    let desde: Date | null = null;
    if (rawDesde instanceof Date) desde = rawDesde;
    else if (typeof rawDesde === "string" || typeof rawDesde === "number") {
      const d = new Date(rawDesde);
      desde = isNaN(d.getTime()) ? null : d;
    }

    return [
      {
        id: crypto.randomUUID(),
        desdeAnio: desde ? desde.getUTCFullYear() : null,
        desdeMes: desde ? desde.getUTCMonth() + 1 : null,
        pct,
        importe,
        moneda: (s.monedaLocal as string) ?? "EUR",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];
  }

  /**
   * Construye una aportacion inicial por inversion (para importar backups v<=3
   * que aun no tenian aportaciones). Mismo criterio que la migracion 0010.
   */
  private seedContributionsFromInvestments(
    investmentRows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    return investmentRows.map((inv) => ({
      id: `mig0010-${inv.id as string}`,
      investmentId: inv.id,
      fecha: inv.fechaCompra ?? inv.createdAt,
      participaciones: inv.participaciones,
      precioUnitario: inv.precioCompra,
      cuentaOrigenId: null,
      movimientoId: null,
      notas: "Aportacion inicial",
      createdAt: inv.createdAt,
      updatedAt: inv.createdAt,
      deletedAt: null,
    }));
  }

  /**
   * Adapta las filas de cuentas del backup al esquema actual (saldoInicial).
   * - v3+: ya traen saldoInicial, se dejan tal cual.
   * - v1/v2: traen `saldo` (saldo actual manual). Calculamos
   *   saldoInicial = saldo - impactoNeto(movimientos) para preservar el
   *   saldo mostrado, y eliminamos la clave `saldo` obsoleta.
   */
  private normalizeAccountRows(
    accountRows: Array<Record<string, unknown>>,
    movRows: Array<Record<string, unknown>>,
    currencyRows: Array<Record<string, unknown>>,
    version: number,
  ): Array<Record<string, unknown>> {
    if (version >= 3) return accountRows;

    const rates = buildRatesMap(currencyRows as unknown as Currency[]);
    const accountsForImpact = accountRows.map((r) => ({
      id: r.id as string,
      moneda: (r.moneda as string) ?? "EUR",
    }));

    const netImpact = computeNetImpactByAccount(
      accountsForImpact,
      movRows.map((m) => ({
        importe: Number(m.importe) || 0,
        moneda: (m.moneda as string) ?? "EUR",
        cuentaOrigenId: (m.cuentaOrigenId as string | null) ?? null,
        cuentaDestinoId: (m.cuentaDestinoId as string | null) ?? null,
        deletedAt: (m.deletedAt as Date | string | null) ?? null,
      })),
      rates,
    );

    return accountRows.map((row) => {
      if ("saldoInicial" in row) return row;
      const { saldo, ...rest } = row;
      const oldSaldo = typeof saldo === "number" ? saldo : 0;
      const id = rest.id as string;
      return { ...rest, saldoInicial: oldSaldo - (netImpact.get(id) ?? 0) };
    });
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
        k === "ultimoInteresAplicado" ||
        k === "objetivoAhorroDesde" ||
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
