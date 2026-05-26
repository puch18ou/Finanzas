/**
 * ============================================================================
 *  src/lib/repositories/currency-repository.ts
 * ============================================================================
 *
 *  Acceso al catalogo de monedas. En este lote solo necesitamos lectura
 *  (para los selectores en la pantalla de Ajustes). En lotes futuros
 *  anadiremos edicion del tipo de cambio.
 * ============================================================================
 */

import { eq, asc } from "drizzle-orm";
import { currencies, type Currency } from "@/lib/db/schema";
import { BaseRepository } from "./base";

export interface ICurrencyRepository {
  /**
   * Devuelve todas las monedas activas, ordenadas por el campo `orden`.
   */
  listActive(): Promise<Currency[]>;

  /**
   * Devuelve TODAS las monedas (activas e inactivas). Util para gestionar
   * el catalogo desde la pantalla de Monedas (futuro).
   */
  listAll(): Promise<Currency[]>;

  /**
   * Busca una moneda por su codigo ISO. Devuelve null si no existe.
   */
  getByCode(code: string): Promise<Currency | null>;
}

export class CurrencyRepository
  extends BaseRepository
  implements ICurrencyRepository
{
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
}
