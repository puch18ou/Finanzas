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
import { ExpenseRepository } from "./expense-repository";
import { MonthlyIncomeRepository } from "./monthly-income-repository";
import { ExtraIncomeRepository } from "./extra-income-repository";

export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
  expenses: ExpenseRepository;
  monthlyIncomes: MonthlyIncomeRepository;
  extraIncomes: ExtraIncomeRepository;
}

export function createRepositories(db: DrizzleDb): Repositories {
  return {
    settings: new SettingsRepository(db),
    currencies: new CurrencyRepository(db),
    categories: new CategoryRepository(db),
    accounts: new AccountRepository(db),
    expenses: new ExpenseRepository(db),
    monthlyIncomes: new MonthlyIncomeRepository(db),
    extraIncomes: new ExtraIncomeRepository(db),
  };
}

// Re-exports utiles
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
export type {
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilter,
} from "./expense-repository";
export type {
  MonthlyIncomeFields,
} from "./monthly-income-repository";
export type {
  CreateExtraIncomeData,
  UpdateExtraIncomeData,
  ExtraIncomeFilter,
} from "./extra-income-repository";
