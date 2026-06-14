-- ============================================================================
--  0027_patrimonio_snapshots.sql
-- ============================================================================
--
--  Historico del patrimonio: una foto al dia del valor neto y su desglose,
--  para dibujar la evolucion real (hoy solo se conoce el valor "de ahora").
--
--    id            = "snap-YYYY-MM-DD" (DETERMINISTA por dia: re-capturar el
--                    mismo dia ACTUALIZA la fila en vez de duplicarla, y asi
--                    seria sync-friendly si en el futuro se sincroniza).
--    fecha         = fecha civil del dia (mediodia UTC, ver utils/dates).
--    moneda        = moneda en que se valoro (la LOCAL: base estable para que
--                    la curva sea comparable aunque cambie la moneda vista).
--    valor_cuentas / valor_inversiones / deuda_total / patrimonio_neto.
--    created_at / updated_at / deleted_at = auditoria (instantes).
-- ============================================================================

CREATE TABLE `patrimonio_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`fecha` integer NOT NULL,
	`moneda` text NOT NULL,
	`valor_cuentas` real NOT NULL,
	`valor_inversiones` real NOT NULL,
	`deuda_total` real NOT NULL,
	`patrimonio_neto` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_patrimonio_snap_fecha` ON `patrimonio_snapshots` (`fecha`);
