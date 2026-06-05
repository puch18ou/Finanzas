-- ============================================================================
--  0019_objetivo_ahorro_tramos.sql
-- ============================================================================
--
--  Objetivo de ahorro con vigencia (tramos). Sustituye el valor unico de
--  settings.objetivo_ahorro_pct / _importe / _desde por una linea temporal:
--  para cada mes, el objetivo vigente es el tramo con mayor `desde` <= mes.
--
--  desde_anio + desde_mes = primer mes en que aplica el tramo.
--  desde_anio = NULL y desde_mes = NULL = tramo BASE "desde siempre".
--
--  El backfill del valor actual (settings) al primer tramo se hace en seed.ts
--  (idempotente), porque requiere parsear el timestamp de objetivo_ahorro_desde.
-- ============================================================================

CREATE TABLE `objetivo_ahorro_tramos` (
	`id` text PRIMARY KEY NOT NULL,
	`desde_anio` integer,
	`desde_mes` integer,
	`pct` real DEFAULT 0 NOT NULL,
	`importe` real DEFAULT 0 NOT NULL,
	`moneda` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `objetivo_tramos_mes_valido` CHECK(`desde_mes` IS NULL OR `desde_mes` BETWEEN 1 AND 12),
	FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_objetivo_tramos_active` ON `objetivo_ahorro_tramos` (`deleted_at`) WHERE `objetivo_ahorro_tramos`.`deleted_at` IS NULL;
