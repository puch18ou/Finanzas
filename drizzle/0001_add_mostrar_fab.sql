-- Migracion 0001: anadir campo `mostrar_fab` a settings.
-- Permite al usuario ocultar el boton flotante de anadido rapido.
ALTER TABLE `settings` ADD COLUMN `mostrar_fab` integer NOT NULL DEFAULT 1;