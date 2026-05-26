/**
 * ============================================================================
 *  src/lib/repositories/index.ts — Container de repositorios
 * ============================================================================
 *
 *  Crea las instancias de los repositorios, todas compartiendo el mismo
 *  cliente Drizzle. Se invoca una sola vez (en DatabaseProvider) y se
 *  expone via context.
 *
 *  POR QUE NO USAR UN PATRON SINGLETON DENTRO DE CADA REPO
 *  -------------------------------------------------------
 *  Algunos proyectos hacen `export const settingsRepo = new SettingsRepository(db)`
 *  como singleton de modulo. No lo hacemos por dos razones:
 *
 *    1. Necesitamos el `db` ya inicializado para crear el repo, lo cual
 *       obliga a un orden de imports fragil.
 *    2. En tests querremos crear repos con BD en memoria distinta a la real.
 *
 *  En su lugar, los repos se crean dinamicamente en DatabaseProvider y se
 *  inyectan por context. Los componentes los consumen con useRepos().
 *
 *  EL DIA DE LA FASE C
 *  -------------------
 *  Cuando metamos sync, esta funcion devolvera implementaciones distintas
 *  (e.g. SyncedSettingsRepository en lugar de SettingsRepository), pero la
 *  firma publica seguira siendo identica. Cero cambios en componentes.
 * ============================================================================
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { SettingsRepository } from "./settings-repository";
import { CurrencyRepository } from "./currency-repository";

/**
 * Bolsa de todos los repositorios disponibles. A medida que avancemos en
 * los lotes, anadiremos category, account, expense, etc.
 */
export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
}

/**
 * Factoria: dada una conexion Drizzle, devuelve la bolsa de repositorios
 * lista para usar.
 */
export function createRepositories(db: DrizzleDb): Repositories {
  return {
    settings: new SettingsRepository(db),
    currencies: new CurrencyRepository(db),
  };
}

// Re-exportamos los tipos por comodidad de los consumidores
export type { ISettingsRepository, SettingsPatch } from "./settings-repository";
export type { ICurrencyRepository } from "./currency-repository";
