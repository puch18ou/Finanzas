/**
 * ============================================================================
 *  src/lib/repositories/currency-repository.ts (ampliado)
 * ============================================================================
 *
 *  CRUD de monedas. Diferencias respecto a otros repos:
 *
 *    - La primary key NO es UUID. Es el codigo ISO ('EUR','SGD','USD'...).
 *      Se pasa explicito al crear.
 *    - NO hay soft delete (este catalogo es mas estable; activa/inactiva
 *      cubre el caso de uso de "ya no quiero verla en selectores").
 *    - Tiene un metodo especial recomputeRatesForNewView() para cuando
 *      el usuario cambia la moneda de visualizacion en Ajustes.
 *
 *  El metodo getByCode() es la equivalencia a getById() de otros repos.
 * ============================================================================
 */

import { eq, asc } from "drizzle-orm";
import { currencies, type Currency, type NewCurrency } from "@/lib/db/schema";
import { BaseRepository, now } from "./base";
import { recomputeRatesForNewView, buildRatesMap } from "@/lib/domain/currency";

export type CreateCurrencyData = Omit<NewCurrency, "createdAt" | "updatedAt">;
export type UpdateCurrencyData = Partial<Omit<NewCurrency, "code" | "createdAt" | "updatedAt">>;

export class CurrencyRepository extends BaseRepository {
  async listActive(): Promise<Currency[]> {
    return this.db
      .select()
      .from(currencies)
      .where(eq(currencies.activa, true))
      .orderBy(asc(currencies.orden), asc(currencies.code));
  }

  async listAll(): Promise<Currency[]> {
    return this.db
      .select()
      .from(currencies)
      .orderBy(asc(currencies.orden), asc(currencies.code));
  }

  async getByCode(code: string): Promise<Currency | null> {
    const rows = await this.db
      .select()
      .from(currencies)
      .where(eq(currencies.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateCurrencyData): Promise<Currency> {
    const ts = now();
    await this.db.insert(currencies).values({
      ...data,
      createdAt: ts,
      updatedAt: ts,
    });

    const created = await this.getByCode(data.code);
    if (!created) throw new Error("CurrencyRepository.create: post-insert read failed");
    return created;
  }

  async update(code: string, patch: UpdateCurrencyData): Promise<Currency> {
    await this.db
      .update(currencies)
      .set({ ...patch, updatedAt: now() })
      .where(eq(currencies.code, code));

    const updated = await this.getByCode(code);
    if (!updated) throw new Error(`CurrencyRepository.update: codigo ${code} no existe`);
    return updated;
  }

  /**
   * Borra una moneda. ATENCION: si alguna FK referencia esta moneda, el
   * INSERT/DELETE fallara por el constraint. En la UI debemos comprobar
   * antes que la moneda no esta en uso (en una version mas elaborada).
   *
   * De momento la UI mostrara el error si pasa.
   */
  async delete(code: string): Promise<void> {
    await this.db.delete(currencies).where(eq(currencies.code, code));
  }

  /**
   * Recalcula los tipos de cambio para una nueva moneda de visualizacion.
   * Llamado desde el repositorio de Settings cuando el usuario cambia la
   * moneda vista.
   *
   * Pasos:
   *   1. Lee todos los rates actuales.
   *   2. Aplica recomputeRatesForNewView (funcion de dominio).
   *   3. UPDATE de cada fila con su nuevo tipoCambioVista.
   *
   * Es una transaccion logica: si una linea falla, el estado queda
   * inconsistente. Drizzle/Tauri no expone transacciones explicitas aun,
   * asi que asumimos exito. En la practica, los UPDATEs son simples y
   * no fallan.
   */
  async recomputeForNewViewCurrency(newViewCurrency: string): Promise<void> {
    const all = await this.listAll();
    const oldRates = buildRatesMap(all);
    const newRates = recomputeRatesForNewView(oldRates, newViewCurrency);

    const ts = now();
    for (const c of all) {
      const newRate = newRates[c.code];
      if (newRate === undefined) continue;
      await this.db
        .update(currencies)
        .set({ tipoCambioVista: newRate, updatedAt: ts })
        .where(eq(currencies.code, c.code));
    }
  }
}
