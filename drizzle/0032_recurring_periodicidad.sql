-- ============================================================================
--  0032_recurring_periodicidad.sql
-- ============================================================================
--
--  Periodicidad flexible de reglas recurrentes (PC). Hasta ahora el motor
--  general (RecurringService) solo entendia reglas MENSUALES por dia_del_mes;
--  la columna `frecuencia` (0012) solo la honraba el generador de aportaciones
--  a inversiones. Ahora el motor general soporta:
--
--    frecuencia:
--      'diaria'     -> cada dia del rango
--      'semanal'    -> un dia de la semana (dia_semana, 0=domingo..6=sabado)
--      'mensual'    -> un dia del mes (dia_del_mes)                [legado]
--      'anual'      -> un dia (dia_del_mes) de un mes (mes_del_anio, 1-12)
--      'varios-mes' -> varios dias del mes (dias_del_mes, lista "1,15")
--
--  Dos columnas nuevas, ambas ADITIVAS y NULLABLE (no rompen datos ni sync):
--    dias_del_mes : lista de dias separados por coma, ej. "1,15". Solo
--                   'varios-mes'. NULL en el resto.
--    mes_del_anio : mes 1-12 de la ocurrencia anual. Solo 'anual'. NULL en el
--                   resto (si NULL, se deriva del mes de fecha_inicio).
--
--  NOTA: `frecuencia` es TEXT sin CHECK, asi que ampliar el conjunto de
--  valores ('anual', 'varios-mes') es a nivel de app; no hay constraint que
--  rehacer ni recompilacion nativa.
-- ============================================================================

ALTER TABLE recurring_rules
  ADD COLUMN dias_del_mes TEXT;

ALTER TABLE recurring_rules
  ADD COLUMN mes_del_anio INTEGER;
