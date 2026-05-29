-- ============================================================================
--  0014_settings_objetivo_ahorro_importe.sql
-- ============================================================================
--
--  Lote 14b: objetivo de ahorro tambien en importe fijo (€/mes), ademas del
--  porcentaje que ya existia (objetivo_ahorro_pct). 0 = sin objetivo de importe.
--  Se interpreta en la moneda local del usuario.
-- ============================================================================

ALTER TABLE settings
  ADD COLUMN objetivo_ahorro_importe REAL NOT NULL DEFAULT 0;
