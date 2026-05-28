-- ============================================================================
--  0009_add_cuenta_por_defecto.sql
-- ============================================================================
--
--  Lote 10b-3: cuenta por defecto global. Se usa para precargar la cuenta
--  origen/destino al crear un movimiento nuevo (formulario y gasto rapido).
--
--  NULL permitido (sin cuenta por defecto). Sin FK explicita, igual que
--  categoria_hipoteca_id, para evitar complicaciones de orden en el seed.
-- ============================================================================

ALTER TABLE settings ADD COLUMN cuenta_por_defecto_id TEXT;
