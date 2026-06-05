-- ============================================================================
--  0020_presupuesto_tramos.sql
-- ============================================================================
--
--  Presupuesto de categoria con vigencia (tramos). Sustituye el valor unico de
--  categories.presupuesto_mensual / _moneda por una linea temporal por
--  categoria: para cada mes, el presupuesto vigente es el tramo con mayor
--  `desde` <= mes.
--
--  desde_anio = NULL y desde_mes = NULL = tramo BASE "desde siempre".
--
--  El backfill del valor actual de cada categoria a su primer tramo se hace en
--  seed.ts (idempotente).
-- ============================================================================

CREATE TABLE `presupuesto_tramos` (
	`id` text PRIMARY KEY NOT NULL,
	`categoria_id` text NOT NULL,
	`desde_anio` integer,
	`desde_mes` integer,
	`importe` real DEFAULT 0 NOT NULL,
	`moneda` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `presupuesto_tramos_mes_valido` CHECK(`desde_mes` IS NULL OR `desde_mes` BETWEEN 1 AND 12),
	FOREIGN KEY (`categoria_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_presupuesto_tramos_cat` ON `presupuesto_tramos` (`categoria_id`) WHERE `presupuesto_tramos`.`deleted_at` IS NULL;
