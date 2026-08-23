/**
 * ============================================================================
 *  src/lib/services/usage-service.ts
 * ============================================================================
 *
 *  Comprueba si una CATEGORIA o una MONEDA estan "en uso", para impedir su
 *  borrado desde la UI (solo se permite editarlas).
 *
 *  CATEGORIA (soft delete): "en uso" = tiene movimientos VIVOS, reglas
 *  recurrentes VIVAS, o es la categoria de la hipoteca. Un presupuesto/tramo
 *  por si solo NO cuenta (decision de Pedro). Como es soft delete, las
 *  referencias nunca se rompen; esto es una barrera semantica.
 *
 *  MONEDA (hard delete): "en uso" = existe CUALQUIER fila que la referencie
 *  (incluidas las de la papelera: la FK apunta a la fila, que sigue existiendo,
 *  asi que el DELETE fisico fallaria) o es una moneda de ajustes (local, vista,
 *  hipoteca, patrimonio inicial). Aqui NO filtramos por deletedAt.
 * ============================================================================
 */

import { isNull } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/proxy-driver";
import {
  accounts,
  categories,
  goals,
  investments,
  mortgage,
  movements,
  objetivoAhorroTramos,
  otherDebts,
  patrimonioSnapshots,
  presupuestoTramos,
  recurringRules,
  settings,
} from "@/lib/db/schema";

export class UsageService {
  constructor(private db: DrizzleDb) {}

  /**
   * Ids de categorias en uso (con movimientos o reglas VIVAS, o categoria de
   * hipoteca). Devuelve un Set para consulta O(1) desde la lista.
   */
  async categoriesInUse(): Promise<Set<string>> {
    const set = new Set<string>();

    const movs = await this.db
      .selectDistinct({ id: movements.categoriaId })
      .from(movements)
      .where(isNull(movements.deletedAt));
    for (const r of movs) if (r.id) set.add(r.id);

    const rules = await this.db
      .selectDistinct({ id: recurringRules.categoriaId })
      .from(recurringRules)
      .where(isNull(recurringRules.deletedAt));
    for (const r of rules) if (r.id) set.add(r.id);

    const s = await this.db
      .select({ cat: settings.categoriaHipotecaId })
      .from(settings);
    for (const row of s) if (row.cat) set.add(row.cat);

    return set;
  }

  /**
   * Ids de cuentas EN USO: referenciadas por movimientos VIVOS (origen o
   * destino) o por reglas recurrentes vivas. No se pueden borrar (se archivan).
   */
  async accountsInUse(): Promise<Set<string>> {
    const set = new Set<string>();
    const addAll = (rows: { id: string | null }[]) => {
      for (const r of rows) if (r.id) set.add(r.id);
    };

    addAll(
      await this.db
        .selectDistinct({ id: movements.cuentaOrigenId })
        .from(movements)
        .where(isNull(movements.deletedAt)),
    );
    addAll(
      await this.db
        .selectDistinct({ id: movements.cuentaDestinoId })
        .from(movements)
        .where(isNull(movements.deletedAt)),
    );
    addAll(
      await this.db
        .selectDistinct({ id: recurringRules.cuentaOrigenId })
        .from(recurringRules)
        .where(isNull(recurringRules.deletedAt)),
    );
    addAll(
      await this.db
        .selectDistinct({ id: recurringRules.cuentaDestinoId })
        .from(recurringRules)
        .where(isNull(recurringRules.deletedAt)),
    );
    return set;
  }

  /**
   * Codigos de moneda en uso por CUALQUIER referencia (incluida la papelera) o
   * por ajustes. Un DELETE fisico de estas fallaria o dejaria datos huerfanos.
   */
  async currenciesInUse(): Promise<Set<string>> {
    const set = new Set<string>();
    const addAll = (rows: { code: string | null }[]) => {
      for (const r of rows) if (r.code) set.add(r.code);
    };

    addAll(await this.db.selectDistinct({ code: accounts.moneda }).from(accounts));
    addAll(await this.db.selectDistinct({ code: movements.moneda }).from(movements));
    addAll(
      await this.db
        .selectDistinct({ code: recurringRules.moneda })
        .from(recurringRules),
    );
    addAll(
      await this.db.selectDistinct({ code: investments.moneda }).from(investments),
    );
    addAll(await this.db.selectDistinct({ code: goals.moneda }).from(goals));
    addAll(await this.db.selectDistinct({ code: mortgage.moneda }).from(mortgage));
    addAll(
      await this.db.selectDistinct({ code: otherDebts.moneda }).from(otherDebts),
    );
    addAll(
      await this.db
        .selectDistinct({ code: categories.presupuestoMoneda })
        .from(categories),
    );
    addAll(
      await this.db
        .selectDistinct({ code: objetivoAhorroTramos.moneda })
        .from(objetivoAhorroTramos),
    );
    addAll(
      await this.db
        .selectDistinct({ code: presupuestoTramos.moneda })
        .from(presupuestoTramos),
    );
    // Sin FK, pero dejaria snapshots huerfanos: tambien bloquea.
    addAll(
      await this.db
        .selectDistinct({ code: patrimonioSnapshots.moneda })
        .from(patrimonioSnapshots),
    );

    // Monedas de ajustes (singleton).
    const s = await this.db
      .select({
        local: settings.monedaLocal,
        vista: settings.monedaVista,
        hipoteca: settings.monedaHipoteca,
        patrimonio: settings.patrimonioInicialMoneda,
      })
      .from(settings);
    for (const row of s) {
      if (row.local) set.add(row.local);
      if (row.vista) set.add(row.vista);
      if (row.hipoteca) set.add(row.hipoteca);
      if (row.patrimonio) set.add(row.patrimonio);
    }

    return set;
  }
}
