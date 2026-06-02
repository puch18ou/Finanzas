-- ============================================================================
--  0017_investment_contributions_comision.sql
-- ============================================================================
--
--  Lote 17: comision opcional por aportacion (modo broker). Se suma al coste
--  total de adquisicion (sube el coste medio) y se descuenta de la cuenta de
--  origen como parte del movimiento de transferencia.
--
--  Aplica tambien a retiradas: reduce el dinero ingresado en la cuenta destino.
-- ============================================================================

ALTER TABLE investment_contributions
  ADD COLUMN comision REAL NOT NULL DEFAULT 0;
