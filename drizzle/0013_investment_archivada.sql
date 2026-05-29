-- ============================================================================
--  0013_investment_archivada.sql
-- ============================================================================
--
--  Lote 13b-2: archivar inversiones. Una inversion "archivada" es una posicion
--  cerrada (valor 0) que se conserva por historial pero queda fuera de la vista
--  activa, los KPIs y el dashboard. Distinto de la papelera (deleted_at).
--
--    archivada: 0 = activa; 1 = archivada.
--
--  Al archivar se cancelan (soft-delete) sus aportaciones periodicas; ver
--  InvestmentContributionService.archiveInvestment.
-- ============================================================================

ALTER TABLE investments
  ADD COLUMN archivada INTEGER NOT NULL DEFAULT 0;
