-- ============================================================================
--  0024_investment_unidades_cotizacion.sql
-- ============================================================================
--
--  Participaciones REALES del usuario para valorar un fondo "por dinero" segun
--  su valor liquidativo (VL): valor = unidades_cotizacion * VL. Es independiente
--  de `participaciones` (que en modo dinero guarda el importe invertido).
--  NULL = no se cotiza por unidades.
-- ============================================================================

ALTER TABLE investments ADD COLUMN unidades_cotizacion REAL;
