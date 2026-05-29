-- ============================================================================
--  0011_contribution_retirada.sql
-- ============================================================================
--
--  Lote 13b: retiradas de inversion. Una fila de investment_contributions puede
--  ser una APORTACION (es_retirada = 0) o una RETIRADA (es_retirada = 1).
--
--  Guardamos participaciones SIEMPRE positivas (respeta el CHECK no-negativos);
--  el recalculo de totales RESTA las retiradas. El movimiento asociado de una
--  retirada es una entrada (transferencia hacia la cuenta destino).
-- ============================================================================

ALTER TABLE investment_contributions
  ADD COLUMN es_retirada INTEGER NOT NULL DEFAULT 0;
