-- ============================================================================
--  0000_init.sql — Migracion inicial
--  Generada a partir de src/lib/db/schema.ts
--  Crea las 12 tablas y todos los indices.
-- ============================================================================
--
--  IMPORTANTE: Una vez aplicada, esta migracion NO se reedita. Los cambios
--  futuros van en migraciones nuevas (0001_*.sql, 0002_*.sql...) que solo
--  contienen el diff sobre el estado anterior.
-- ============================================================================

CREATE TABLE `currencies` (
    `code` text PRIMARY KEY NOT NULL,
    `nombre` text NOT NULL,
    `simbolo` text NOT NULL,
    `tipo_cambio_vista` real NOT NULL,
    `orden` integer DEFAULT 0 NOT NULL,
    `activa` integer DEFAULT 1 NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `settings` (
    `id` text PRIMARY KEY NOT NULL,
    `moneda_local` text NOT NULL,
    `moneda_vista` text NOT NULL,
    `anio_actual` integer NOT NULL,
    `mes_actual` integer NOT NULL,
    `objetivo_ahorro_pct` real DEFAULT 0.2 NOT NULL,
    `tiene_hipoteca` integer DEFAULT 0 NOT NULL,
    `moneda_hipoteca` text,
    `categoria_hipoteca_id` text,
    `patrimonio_inicial` real DEFAULT 0 NOT NULL,
    `patrimonio_inicial_moneda` text,
    `tema` text DEFAULT 'system' NOT NULL,
    `idioma` text DEFAULT 'es' NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    CONSTRAINT `settings_singleton` CHECK(`id` = 'singleton'),
    CONSTRAINT `settings_mes_valido` CHECK(`mes_actual` BETWEEN 1 AND 12),
    FOREIGN KEY (`moneda_local`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`moneda_vista`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`moneda_hipoteca`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`patrimonio_inicial_moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `categories` (
    `id` text PRIMARY KEY NOT NULL,
    `nombre` text NOT NULL,
    `tipo` text NOT NULL,
    `presupuesto_mensual` real DEFAULT 0 NOT NULL,
    `presupuesto_moneda` text NOT NULL,
    `notas` text,
    `orden` integer DEFAULT 0 NOT NULL,
    `color` text,
    `icono` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    FOREIGN KEY (`presupuesto_moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_categories_active` ON `categories` (`deleted_at`) WHERE `categories`.`deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_categories_orden` ON `categories` (`orden`);
--> statement-breakpoint

CREATE TABLE `accounts` (
    `id` text PRIMARY KEY NOT NULL,
    `entidad` text NOT NULL,
    `tipo` text NOT NULL,
    `alias` text NOT NULL,
    `saldo` real DEFAULT 0 NOT NULL,
    `moneda` text NOT NULL,
    `activa` integer DEFAULT 1 NOT NULL,
    `notas` text,
    `orden` integer DEFAULT 0 NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_accounts_active` ON `accounts` (`deleted_at`,`activa`) WHERE `accounts`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `expenses` (
    `id` text PRIMARY KEY NOT NULL,
    `fecha` integer NOT NULL,
    `concepto` text NOT NULL,
    `categoria_id` text NOT NULL,
    `importe` real NOT NULL,
    `moneda` text NOT NULL,
    `cuenta_id` text,
    `mes` integer NOT NULL,
    `anio` integer NOT NULL,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `expenses_importe_no_neg` CHECK(`importe` >= 0),
    CONSTRAINT `expenses_mes_valido` CHECK(`mes` BETWEEN 1 AND 12),
    FOREIGN KEY (`categoria_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`cuenta_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_expenses_anio_mes` ON `expenses` (`anio`,`mes`) WHERE `expenses`.`deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_expenses_categoria` ON `expenses` (`categoria_id`) WHERE `expenses`.`deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_expenses_fecha` ON `expenses` (`fecha`) WHERE `expenses`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `monthly_incomes` (
    `id` text PRIMARY KEY NOT NULL,
    `anio` integer NOT NULL,
    `mes` integer NOT NULL,
    `salario` real DEFAULT 0 NOT NULL,
    `bonus` real DEFAULT 0 NOT NULL,
    `otros` real DEFAULT 0 NOT NULL,
    `moneda` text NOT NULL,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `monthly_incomes_mes_valido` CHECK(`mes` BETWEEN 1 AND 12),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE UNIQUE INDEX `ux_monthly_incomes_anio_mes` ON `monthly_incomes` (`anio`,`mes`);
--> statement-breakpoint

CREATE TABLE `extra_incomes` (
    `id` text PRIMARY KEY NOT NULL,
    `fecha` integer NOT NULL,
    `concepto` text NOT NULL,
    `categoria` text NOT NULL,
    `tipo` text DEFAULT 'Ingreso extra' NOT NULL,
    `importe` real NOT NULL,
    `moneda` text NOT NULL,
    `mes` integer NOT NULL,
    `anio` integer NOT NULL,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `extra_incomes_mes_valido` CHECK(`mes` BETWEEN 1 AND 12),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_extra_incomes_anio_mes` ON `extra_incomes` (`anio`,`mes`) WHERE `extra_incomes`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `investments` (
    `id` text PRIMARY KEY NOT NULL,
    `tipo` text NOT NULL,
    `ticker` text,
    `nombre` text NOT NULL,
    `participaciones` real NOT NULL,
    `precio_compra` real NOT NULL,
    `precio_actual` real NOT NULL,
    `moneda` text NOT NULL,
    `fecha_compra` integer,
    `cuenta_id` text,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `investments_cantidad_no_neg` CHECK(`participaciones` >= 0 AND `precio_compra` >= 0 AND `precio_actual` >= 0),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`cuenta_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_investments_active` ON `investments` (`deleted_at`) WHERE `investments`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `goals` (
    `id` text PRIMARY KEY NOT NULL,
    `nombre` text NOT NULL,
    `importe_objetivo` real NOT NULL,
    `ya_ahorrado` real DEFAULT 0 NOT NULL,
    `moneda` text NOT NULL,
    `fecha_objetivo` integer NOT NULL,
    `cuenta_vinculada_id` text,
    `notas` text,
    `completada` integer DEFAULT 0 NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `goals_importes_validos` CHECK(`importe_objetivo` > 0 AND `ya_ahorrado` >= 0),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`cuenta_vinculada_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_goals_active` ON `goals` (`deleted_at`) WHERE `goals`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `mortgage` (
    `id` text PRIMARY KEY NOT NULL,
    `activa` integer DEFAULT 1 NOT NULL,
    `precio_vivienda` real NOT NULL,
    `entrada` real NOT NULL,
    `gastos_asociados` real DEFAULT 0 NOT NULL,
    `plazo_anios` integer NOT NULL,
    `tin` real NOT NULL,
    `tipo` text NOT NULL,
    `diferencial` real DEFAULT 0 NOT NULL,
    `tipo_referencia` real DEFAULT 0 NOT NULL,
    `anios_tipo_fijo` integer DEFAULT 0 NOT NULL,
    `moneda` text NOT NULL,
    `fecha_inicio` integer NOT NULL,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE `other_debts` (
    `id` text PRIMARY KEY NOT NULL,
    `concepto` text NOT NULL,
    `tipo` text NOT NULL,
    `importe_inicial` real NOT NULL,
    `capital_pendiente` real NOT NULL,
    `tin` real NOT NULL,
    `plazo_restante_meses` integer NOT NULL,
    `moneda` text NOT NULL,
    `fecha_inicio` integer,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `other_debts_valores_validos` CHECK(`capital_pendiente` >= 0 AND `plazo_restante_meses` >= 0),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `idx_other_debts_active` ON `other_debts` (`deleted_at`) WHERE `other_debts`.`deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE `sync_log` (
    `id` text PRIMARY KEY NOT NULL,
    `tabla` text NOT NULL,
    `registro_id` text NOT NULL,
    `operacion` text NOT NULL,
    `payload` text,
    `timestamp` integer NOT NULL,
    `sincronizado` integer DEFAULT 0 NOT NULL,
    `sincronizado_at` integer,
    `intentos` integer DEFAULT 0 NOT NULL,
    `ultimo_error` text
);
--> statement-breakpoint

CREATE INDEX `idx_sync_log_pending` ON `sync_log` (`sincronizado`,`timestamp`) WHERE `sync_log`.`sincronizado` = 0;
