-- ============================================================================
--  0033_settings_incluir_previstos.sql
-- ============================================================================
--
--  Interruptor global para incluir (o no) los gastos PREVISTOS del mes
--  (recurrentes aun no generados) en los totales de consumo: dashboard,
--  presupuestos, categorias y evolucion. Por defecto activado (1), que es el
--  comportamiento actual.
--
--  Aditiva y con default: no rompe datos ni sync.
-- ============================================================================

ALTER TABLE settings
  ADD COLUMN incluir_previstos INTEGER NOT NULL DEFAULT 1;
