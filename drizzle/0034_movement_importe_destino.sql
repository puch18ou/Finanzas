-- ============================================================================
--  0034_movement_importe_destino.sql
-- ============================================================================
--
--  Transferencias entre cuentas de DISTINTA divisa: guarda el importe que
--  ENTRA en la cuenta destino, ya expresado en la moneda del destino. Asi el
--  tipo de cambio queda FIJADO en el momento de la transferencia (el usuario
--  puede editarlo) y el saldo del destino no fluctua con los cambios de hoy.
--
--  NULL = no aplica: mismo par de divisas, o cualquier otro tipo de
--  movimiento, o transferencias antiguas (que siguen calculando el destino con
--  el tipo de cambio en vivo, como hasta ahora). Ver domain/accounts.ts.
--
--  Columna aditiva y nullable: compatible con sync y backups existentes.
-- ============================================================================

ALTER TABLE movements ADD COLUMN importe_destino REAL;
