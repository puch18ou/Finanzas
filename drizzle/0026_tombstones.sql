-- ============================================================================
--  0026_tombstones.sql
-- ============================================================================
--
--  Fase 2 (multi-dispositivo, sync P2P). Lapidas de borrado: al vaciar la
--  papelera el registro se borra fisicamente de su tabla, pero dejamos aqui
--  una marca ligera (id + tabla + cuando) para que el borrado se propague a
--  los otros dispositivos en vez de resucitar.
--
--    id        = id del registro borrado (UUID, unico entre tablas).
--    tabla     = tabla de origen.
--    deleted_at / updated_at = momento del borrado (lo usa el LWW).
-- ============================================================================

CREATE TABLE `tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`tabla` text NOT NULL,
	`deleted_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tombstones_updated` ON `tombstones` (`updated_at`);
