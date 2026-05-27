/**
 * src/lib/repositories/index.ts — Container de repositorios + servicios
 *
 * Añade `movements` al container existente.
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { SettingsRepository } from "./settings-repository";
import { CurrencyRepository } from "./currency-repository";
import { CategoryRepository } from "./category-repository";
import { AccountRepository } from "./account-repository";
import { ExpenseRepository } from "./expense-repository";
import { MonthlyIncomeRepository } from "./monthly-income-repository";
import { ExtraIncomeRepository } from "./extra-income-repository";
import { InvestmentRepository } from "./investment-repository";
import { GoalRepository } from "./goal-repository";
import { MortgageRepository } from "./mortgage-repository";
import { OtherDebtRepository } from "./other-debt-repository";
import { MovementRepository } from "./movement-repository";
import { TrashService } from "@/lib/services/trash-service";
import { BackupService } from "@/lib/services/backup-service";

export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
  expenses: ExpenseRepository;
  monthlyIncomes: MonthlyIncomeRepository;
  extraIncomes: ExtraIncomeRepository;
  investments: InvestmentRepository;
  goals: GoalRepository;
  mortgage: MortgageRepository;
  otherDebts: OtherDebtRepository;
  movements: MovementRepository;
  trash: TrashService;
  backup: BackupService;
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
    investments: new InvestmentRepository(db),
    goals: new GoalRepository(db),
    mortgage: new MortgageRepository(db),
    otherDebts: new OtherDebtRepository(db),
    movements: new MovementRepository(db),
    trash: new TrashService(db),
    backup: new BackupService(db),
  };
}

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
export type {
  CreateInvestmentData,
  UpdateInvestmentData,
} from "./investment-repository";
export type {
  CreateGoalData,
  UpdateGoalData,
} from "./goal-repository";
export type { MortgageData } from "./mortgage-repository";
export type {
  CreateOtherDebtData,
  UpdateOtherDebtData,
} from "./other-debt-repository";
export type {
  CreateMovementData,
  UpdateMovementData,
  MovementFilter,
  MovementType,
} from "./movement-repository";
export type {
  TrashItem,
  TrashItemType,
  TrashCounts,
} from "@/lib/services/trash-service";
export type { BackupFile } from "@/lib/services/backup-service";
