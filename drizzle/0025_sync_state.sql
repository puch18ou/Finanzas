-- ============================================================================
--  0025_sync_state.sql
-- ============================================================================
--
--  Fase 2 (multi-dispositivo, sync peer-to-peer). Estado LOCAL de
--  sincronizacion: una fila por dispositivo-par conocido con los cursores que
--  evitan reenviar lo ya intercambiado.
--
--    last_pulled_at = mayor updated_at ya integrado de ese par.
--    last_pushed_at = mayor updated_at ya enviado a ese par.
--
--  Esta tabla NO se sincroniza (es plomeria local). La identidad del propio
--  dispositivo (deviceId) vive en localStorage, no aqui. Sin soft-delete y sin
--  FK a proposito: olvidar un par es borrar su fila.
-- ============================================================================

CREATE TABLE `sync_state` (
	`peer_device_id` text PRIMARY KEY NOT NULL,
	`peer_nombre` text,
	`last_pulled_at` integer,
	`last_pushed_at` integer,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
