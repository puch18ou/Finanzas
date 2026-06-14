-- ============================================================================
--  0028_movement_etiquetas.sql
-- ============================================================================
--
--  Etiquetas (tags) transversales en los movimientos: una 2a dimension ademas
--  de la categoria (1 categoria + N etiquetas). Se guardan como lista separada
--  por comas, normalizada (minusculas), en una sola columna TEXT. Ver
--  domain/tags.ts. Columna aditiva y nullable: compatible con sync y backups.
-- ============================================================================

ALTER TABLE movements ADD COLUMN etiquetas TEXT;
