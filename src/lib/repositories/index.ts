/**
 * src/lib/repositories/index.ts
 *
 * Lote 11c-fix: MortgageDebtSyncService recibe ahora tambien el db
 * (necesario para buscar categorias y actualizar movements masivos).
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";
import { SettingsRepository } from "./settings-repository";
import { CurrencyRepository } from "./currency-repository";
import { CategoryRepository } from "./category-repository";
import { AccountRepository } from "./account-repository";
import { InvestmentRepository } from "./investment-repository";
import { GoalRepository } from "./goal-repository";
import { MortgageRepository } from "./mortgage-repository";
import { OtherDebtRepository } from "./other-debt-repository";
import { MovementRepository } from "./movement-repository";
import { RecurringRuleRepository } from "./recurring-rule-repository";
import { TrashService } from "@/lib/services/trash-service";
import { BackupService } from "@/lib/services/backup-service";
import { RecurringService } from "@/lib/services/recurring-service";
import { MortgageDebtSyncService } from "@/lib/services/mortgage-debt-sync-service";

export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
  investments: InvestmentRepository;
  goals: GoalRepository;
  mortgage: MortgageRepository;
  otherDebts: OtherDebtRepository;
  movements: MovementRepository;
  recurringRules: RecurringRuleRepository;
  trash: TrashService;
  backup: BackupService;
  recurringService: RecurringService;
  mortgageDebtSync: MortgageDebtSyncService;
}

export function createRepositories(db: DrizzleDb): Repositories {
  const recurringRules = new RecurringRuleRepository(db);
  const recurringService = new RecurringService(db);
  const mortgageDebtSync = new MortgageDebtSyncService(
    recurringRules,
    recurringService,
    db,
  );

  return {
    settings: new SettingsRepository(db),
    currencies: new CurrencyRepository(db),
    categories: new CategoryRepository(db),
    accounts: new AccountRepository(db),
    investments: new InvestmentRepository(db),
    goals: new GoalRepository(db),
    mortgage: new MortgageRepository(db),
    otherDebts: new OtherDebtRepository(db),
    movements: new MovementRepository(db),
    recurringRules,
    trash: new TrashService(db),
    backup: new BackupService(db),
    recurringService,
    mortgageDebtSync,
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
  CreateRecurringRuleData,
  UpdateRecurringRuleData,
  RecurringRuleType,
  RecurringRuleOrigen,
} from "./recurring-rule-repository";
export type {
  TrashItem,
  TrashItemType,
  TrashCounts,
} from "@/lib/services/trash-service";
export type { BackupFile } from "@/lib/services/backup-service";
