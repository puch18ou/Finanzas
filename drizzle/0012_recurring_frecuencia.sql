-- ============================================================================
--  0012_recurring_frecuencia.sql
-- ============================================================================
--
--  Lote 13b-2: frecuencia de las reglas recurrentes. Hasta ahora todas eran
--  mensuales (campo dia_del_mes). Para las aportaciones periodicas a
--  inversiones queremos tambien diaria y semanal.
--
--    frecuencia: 'diaria' | 'semanal' | 'mensual'. Default 'mensual' para que
--                las reglas existentes (salario, hipoteca, etc.) no cambien.
--    dia_semana: 0=domingo .. 6=sabado (convencion getUTCDay). Solo aplica a
--                las reglas semanales; NULL en el resto.
--
--  El motor mensual (RecurringService) ignora estos campos: solo los usa el
--  generador de aportaciones periodicas (InvestmentContributionService).
-- ============================================================================

ALTER TABLE recurring_rules
  ADD COLUMN frecuencia TEXT NOT NULL DEFAULT 'mensual';

ALTER TABLE recurring_rules
  ADD COLUMN dia_semana INTEGER;
