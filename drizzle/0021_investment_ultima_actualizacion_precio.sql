-- ============================================================================
--  0021_investment_ultima_actualizacion_precio.sql
-- ============================================================================
--
--  Marca de tiempo de la ultima actualizacion de precioActual desde una API de
--  cotizacion. NULL = nunca actualizado por API (o solo manualmente).
-- ============================================================================

ALTER TABLE investments ADD COLUMN ultima_actualizacion_precio INTEGER;
