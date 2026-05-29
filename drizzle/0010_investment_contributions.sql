-- ============================================================================
--  0010_investment_contributions.sql
-- ============================================================================
--
--  Lote 13a: aportaciones por inversion. Una inversion deja de ser una sola
--  compra: pasa a tener un historial de aportaciones (participaciones + precio
--  + fecha). El total de participaciones y el coste medio de la inversion se
--  recalculan desde aqui, pero siguen CACHEADOS en investments.participaciones
--  y investments.precio_compra para no romper a los consumidores existentes
--  (tabla, dashboard, proyeccion).
--
--  Cada aportacion puede llevar asociado un movimiento de salida de una cuenta
--  (transferencia) -> movimiento_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS investment_contributions (
  id TEXT PRIMARY KEY NOT NULL,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  fecha INTEGER NOT NULL,
  participaciones REAL NOT NULL,
  precio_unitario REAL NOT NULL,
  cuenta_origen_id TEXT REFERENCES accounts(id),
  movimiento_id TEXT REFERENCES movements(id),
  notas TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_inv_contrib_investment
  ON investment_contributions(investment_id)
  WHERE deleted_at IS NULL;

-- Siembra una aportacion inicial por cada inversion existente a partir de su
-- compra actual. Idempotente: solo inserta si la inversion no tiene ninguna.
-- El id es determinista ('mig0010-' || id de la inversion), unico por inversion.
INSERT INTO investment_contributions
  (id, investment_id, fecha, participaciones, precio_unitario, cuenta_origen_id, movimiento_id, notas, created_at, updated_at, deleted_at)
SELECT
  'mig0010-' || i.id,
  i.id,
  COALESCE(i.fecha_compra, i.created_at),
  i.participaciones,
  i.precio_compra,
  NULL,
  NULL,
  'Aportacion inicial',
  i.created_at,
  i.created_at,
  NULL
FROM investments i
WHERE NOT EXISTS (
  SELECT 1 FROM investment_contributions c WHERE c.investment_id = i.id
);
