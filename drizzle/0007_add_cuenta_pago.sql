-- ============================================================================
--  0007_add_cuenta_pago.sql
-- ============================================================================
--
--  Añade columna `cuenta_pago_id` a las tablas mortgage y other_debts.
--  NULL permitido. Es la cuenta desde la que se paga la cuota mensual.
--
--  Cuando se genere el movement de cuota (RecurringService), llevara
--  esta cuenta como cuenta_origen_id (sale dinero de la cuenta).
-- ============================================================================

ALTER TABLE mortgage ADD COLUMN cuenta_pago_id TEXT REFERENCES accounts(id);
ALTER TABLE other_debts ADD COLUMN cuenta_pago_id TEXT REFERENCES accounts(id);
