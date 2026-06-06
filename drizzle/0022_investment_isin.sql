-- ============================================================================
--  0022_investment_isin.sql
-- ============================================================================
--
--  ISIN (12 caracteres) del activo de inversion. Identificador estable; se usa
--  para resolver el simbolo de cotizacion (ISIN -> ticker) y como referencia.
--  NULL = sin ISIN.
-- ============================================================================

ALTER TABLE investments ADD COLUMN isin TEXT;
