/**
 * ============================================================================
 *  src/lib/repositories/index.ts — Container de repositorios
 * ============================================================================
 *
 *  Crea las instancias de los repositorios compartiendo el mismo cliente
 *  Drizzle. Se invoca una sola vez en DatabaseProvider.
 *
 *  Ver comentarios en src/contexts/DatabaseProvider.tsx para entender
 *  por que no usamos singletons de modulo.
 * ============================================================================
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { SettingsRepository } from "./settings-repository";
import { CurrencyRepository } from "./currency-repository";
import { CategoryRepository } from "./category-repository";
import { AccountRepository } from "./account-repository";

export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
}

export function createRepositories(db: DrizzleDb): Repositories {
  return {
    settings: new SettingsRepository(db),
    currencies: new CurrencyRepository(db),
    categories: new CategoryRepository(db),
    accounts: new AccountRepository(db),
  };
}

// Re-exports utiles para los consumidores
export type { ISettingsRepository, SettingsPatch } from "./settings-repository";
export type {
  CreateCategoryData,
  UpdateCategoryData,
} from "./category-repository";
export type {
  CreateAccountData,
  UpdateAccountData,
} from "./account-repository";
export type {
  CreateCurrencyData,
  UpdateCurrencyData,
} from "./currency-repository";
