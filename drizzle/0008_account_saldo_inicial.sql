-- ============================================================================
--  0008_account_saldo_inicial.sql
-- ============================================================================
--
--  Lote 10b: el saldo de las cuentas pasa a CALCULARSE desde los movimientos.
--
--  El campo `saldo` (saldo actual, manual) se renombra a `saldo_inicial`
--  (saldo de partida). A partir de ahora:
--
--      saldo_actual = saldo_inicial + impacto_neto(movimientos)
--
--  Para que el saldo MOSTRADO no cambie tras la migracion, recalculamos
--  saldo_inicial restandole el impacto neto de los movimientos que ya
--  existen (gasto/cuota restan como origen, ingreso/intereses suman como
--  destino, transferencia/ajuste segun el campo). Asi:
--
--      saldo_inicial_nuevo = saldo_antiguo - impacto_neto_existente
--
--  y por tanto saldo_inicial_nuevo + impacto_neto_existente = saldo_antiguo.
-- ============================================================================

ALTER TABLE accounts RENAME COLUMN saldo TO saldo_inicial;

UPDATE accounts
SET saldo_inicial = saldo_inicial - (
  COALESCE(
    (SELECT SUM(m.importe) FROM movements m
      WHERE m.cuenta_destino_id = accounts.id AND m.deleted_at IS NULL),
    0
  )
  - COALESCE(
    (SELECT SUM(m.importe) FROM movements m
      WHERE m.cuenta_origen_id = accounts.id AND m.deleted_at IS NULL),
    0
  )
);
