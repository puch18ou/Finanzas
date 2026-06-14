-- ============================================================================
--  0029_contribution_plusvalia.sql
-- ============================================================================
--
--  Plusvalia/minusvalia REALIZADA en las retiradas (ventas): dinero recibido
--  bruto - coste de las participaciones vendidas, en la moneda de la inversion.
--  null en aportaciones. Columna aditiva y nullable: compatible con sync y
--  backups. Ver domain/investments.realizedGain.
-- ============================================================================

ALTER TABLE investment_contributions ADD COLUMN plusvalia_realizada REAL;
