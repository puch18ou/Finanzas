-- ============================================================================
--  0015_remove_oro_tipo.sql
-- ============================================================================
--
--  Lote 15a: el tipo "Oro" desaparece del selector de inversiones. El oro se
--  trata como una accion mas (participaciones + precio por unidad). Las
--  inversiones existentes con tipo='Oro' se migran a tipo='Acciones' para
--  que dejen de estar en "modo solo dinero" y pasen a usar participaciones.
--
--  Nota: si una inversion de Oro estaba guardada en modo dinero (con
--  participaciones=importe y precio=1), tras la migracion los numeros pueden
--  no reflejar la realidad (gramos / precio por gramo). El usuario debera
--  editar manualmente esa inversion para fijar participaciones y precio.
-- ============================================================================

UPDATE investments
SET tipo = 'Acciones', updated_at = (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE tipo = 'Oro';
