-- ============================================================================
--  0031_movement_gasto_asociado.sql
-- ============================================================================
--
--  Vincula una DEVOLUCION (tipo 'devolucion') al GASTO concreto que reembolsa,
--  para poder calcular el "coste real" de ese gasto (importe - devoluciones).
--
--  gasto_asociado_id apunta al id del movimiento de gasto. NULL = devolucion
--  suelta (sin gasto asociado), que es el comportamiento actual y sigue siendo
--  valido. Solo tiene sentido en movimientos tipo 'devolucion'.
--
--  Columna aditiva y nullable: compatible con sync y backups existentes.
-- ============================================================================

ALTER TABLE movements ADD COLUMN gasto_asociado_id TEXT;
