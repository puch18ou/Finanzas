-- ============================================================================
--  0018_settings_objetivo_ahorro_desde.sql
-- ============================================================================
--
--  Fecha "desde cuando" la meta de ahorro es efectiva. Aplica tanto al
--  objetivo en porcentaje como al objetivo en importe. NULL = sin fecha
--  (cuenta desde siempre, comportamiento previo).
-- ============================================================================

ALTER TABLE settings ADD COLUMN objetivo_ahorro_desde INTEGER;
