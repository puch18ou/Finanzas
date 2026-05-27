-- Migracion 0002: anadir flag `integrar_cuota_hipoteca` a settings.
-- Si esta a 1, el Dashboard sumara la cuota mensual de la hipoteca a los
-- gastos del mes activo.
ALTER TABLE `settings` ADD COLUMN `integrar_cuota_hipoteca` integer NOT NULL DEFAULT 0;
