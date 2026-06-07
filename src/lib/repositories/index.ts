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
import { InvestmentContributionRepository } from "./investment-contribution-repository";
import { GoalRepository } from "./goal-repository";
import { MortgageRepository } from "./mortgage-repository";
import { OtherDebtRepository } from "./other-debt-repository";
import { MovementRepository } from "./movement-repository";
import { RecurringRuleRepository } from "./recurring-rule-repository";
import { ObjetivoAhorroTramoRepository } from "./objetivo-ahorro-tramo-repository";
import { PresupuestoTramoRepository } from "./presupuesto-tramo-repository";
import { SyncStateRepository } from "./sync-state-repository";
import { TrashService } from "@/lib/services/trash-service";
import { BackupService } from "@/lib/services/backup-service";
import { RecurringService } from "@/lib/services/recurring-service";
import { MortgageDebtSyncService } from "@/lib/services/mortgage-debt-sync-service";
import { InvestmentContributionService } from "@/lib/services/investment-contribution-service";
import { InvestmentInterestService } from "@/lib/services/investment-interest-service";

export interface Repositories {
  settings: SettingsRepository;
  currencies: CurrencyRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
  investments: InvestmentRepository;
  investmentContributions: InvestmentContributionRepository;
  goals: GoalRepository;
  mortgage: MortgageRepository;
  otherDebts: OtherDebtRepository;
  movements: MovementRepository;
  recurringRules: RecurringRuleRepository;
  objetivoTramos: ObjetivoAhorroTramoRepository;
  presupuestoTramos: PresupuestoTramoRepository;
  syncState: SyncStateRepository;
  trash: TrashService;
  backup: BackupService;
  recurringService: RecurringService;
  mortgageDebtSync: MortgageDebtSyncService;
  investmentContributionService: InvestmentContributionService;
  investmentInterestService: InvestmentInterestService;
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
    investmentContributions: new InvestmentContributionRepository(db),
    goals: new GoalRepository(db),
    mortgage: new MortgageRepository(db),
    otherDebts: new OtherDebtRepository(db),
    movements: new MovementRepository(db),
    recurringRules,
    objetivoTramos: new ObjetivoAhorroTramoRepository(db),
    presupuestoTramos: new PresupuestoTramoRepository(db),
    syncState: new SyncStateRepository(db),
    trash: new TrashService(db),
    backup: new BackupService(db),
    recurringService,
    mortgageDebtSync,
    investmentContributionService: new InvestmentContributionService(db),
    investmentInterestService: new InvestmentInterestService(db),
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
export type { CreateContributionData } from "./investment-contribution-repository";
export type {
  AddContributionArgs,
  WithdrawArgs,
  UpdateContributionArgs,
} from "@/lib/services/investment-contribution-service";
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
  CreateObjetivoAhorroTramoData,
  UpdateObjetivoAhorroTramoData,
} from "./objetivo-ahorro-tramo-repository";
export type {
  CreatePresupuestoTramoData,
  UpdatePresupuestoTramoData,
} from "./presupuesto-tramo-repository";
export type {
  TrashItem,
  TrashItemType,
  TrashCounts,
} from "@/lib/services/trash-service";
export type { BackupFile } from "@/lib/services/backup-service";
