-- ============================================================================
--  0004_drop_legacy_movement_tables.sql
-- ============================================================================
--
--  Elimina las tablas `expenses` y `extra_incomes` que han sido sustituidas
--  por `movements` en el Lote 10a-1.
--
--  Antes de aplicar esta migracion, la 0003 ya copio los datos activos.
--  Los datos en soft-delete (papelera) no se copiaron, por lo que se
--  perderan al hacer DROP. Asumimos que el usuario ya consulto su
--  papelera y/o no le importan esos datos antiguos.
-- ============================================================================

DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS extra_incomes;
