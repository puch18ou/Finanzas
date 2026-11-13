-- ============================================================================
--  0035_contribution_importe_cuenta.sql
-- ============================================================================
--
--  Aportaciones a una inversion en divisa DISTINTA de la cuenta de origen.
--  Cuando la inversion cotiza en una moneda (p.ej. USD) pero el dinero sale de
--  una cuenta en otra (p.ej. EUR), guardamos el importe REAL que sale de la
--  cuenta, ya en la moneda de la cuenta. Asi el tipo de cambio queda FIJADO en
--  el momento de la aportacion (el usuario puede editarlo) y el saldo de la
--  cuenta no fluctua con el cambio de hoy.
--
--  NULL = misma divisa (sin conversion) o aportaciones antiguas. El movimiento
--  de cargo se crea en la moneda de la cuenta cuando este valor existe.
--
--  Columna aditiva y nullable: compatible con sync y backups existentes.
-- ============================================================================

ALTER TABLE investment_contributions ADD COLUMN importe_cuenta REAL;
