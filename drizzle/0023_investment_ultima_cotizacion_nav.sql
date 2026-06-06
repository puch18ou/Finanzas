-- ============================================================================
--  0023_investment_ultima_cotizacion_nav.sql
-- ============================================================================
--
--  Para fondos "por dinero" (sin unidades): ultimo valor liquidativo (VL) visto
--  al cotizar, en la moneda del activo. Se usa para escalar el valor de la
--  posicion por el movimiento del VL entre actualizaciones. NULL = sin
--  referencia todavia (la primera cotizacion la fija).
-- ============================================================================

ALTER TABLE investments ADD COLUMN ultima_cotizacion_nav REAL;
