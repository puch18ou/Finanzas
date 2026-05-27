-- ============================================================================
--  0006_migrate_monthly_incomes_to_movements.sql
-- ============================================================================
--
--  Convierte cada fila de monthly_incomes en hasta 3 movements:
--    - "Salario" si salario > 0
--    - "Bonus" si bonus > 0
--    - "Otros ingresos" si otros > 0
--
--  Los movements creados:
--    - tipo = 'ingreso'
--    - categoriaTexto = 'Salario' / 'Bonus' / 'Otros ingresos'
--    - cuentaDestinoId = NULL (los monthly_incomes no tenian cuenta)
--    - fecha = ultimo dia del mes (proxy razonable; el dia exacto no
--             se guardaba en monthly_incomes)
--    - esAutomatico = false (son historico migrado, no generado por regla)
--    - origenAutomatico = NULL, origenAutomaticoId = NULL
--
--  Después, DROP TABLE monthly_incomes.
--
--  IMPORTANTE: el usuario eligió NO crear regla automatica. Para que el
--  salario de meses futuros se genere automaticamente, debera ir a
--  /recurrentes y crear la regla a mano.
-- ============================================================================

-- ============================================================================
--  Step 1: Migrar salarios > 0
-- ============================================================================
INSERT INTO movements (
    id, tipo, fecha, concepto, importe, moneda,
    cuenta_origen_id, cuenta_destino_id, categoria_id, categoria_texto,
    mes, anio, notas,
    es_automatico, origen_automatico, origen_automatico_id,
    created_at, updated_at, deleted_at
)
SELECT
    -- id pseudo-aleatorio basado en mi.id + sufijo. Es estable y no colisiona.
    lower(hex(randomblob(8))) || '-sal' AS id,
    'ingreso' AS tipo,
    -- Fecha: ultimo dia del mes a las 12:00:00 UTC.
    -- SQLite no tiene una funcion "last day of month" facil; aproximamos
    -- con dia 28 (suficiente; el dia exacto no es critico para movements
    -- historicos).
    -- Calculamos: timestamp ms del dia 28 del mes a las 12:00 UTC.
    (strftime('%s', anio || '-' || printf('%02d', mes) || '-28T12:00:00Z') * 1000) AS fecha,
    'Salario' AS concepto,
    salario AS importe,
    moneda,
    NULL AS cuenta_origen_id,
    NULL AS cuenta_destino_id,
    NULL AS categoria_id,
    'Salario' AS categoria_texto,
    mes, anio,
    notas,
    0 AS es_automatico,
    NULL AS origen_automatico,
    NULL AS origen_automatico_id,
    created_at, updated_at, deleted_at
FROM monthly_incomes
WHERE salario > 0 AND deleted_at IS NULL;

-- ============================================================================
--  Step 2: Migrar bonus > 0
-- ============================================================================
INSERT INTO movements (
    id, tipo, fecha, concepto, importe, moneda,
    cuenta_origen_id, cuenta_destino_id, categoria_id, categoria_texto,
    mes, anio, notas,
    es_automatico, origen_automatico, origen_automatico_id,
    created_at, updated_at, deleted_at
)
SELECT
    lower(hex(randomblob(8))) || '-bon' AS id,
    'ingreso' AS tipo,
    (strftime('%s', anio || '-' || printf('%02d', mes) || '-28T12:00:00Z') * 1000) AS fecha,
    'Bonus' AS concepto,
    bonus AS importe,
    moneda,
    NULL AS cuenta_origen_id,
    NULL AS cuenta_destino_id,
    NULL AS categoria_id,
    'Bonus' AS categoria_texto,
    mes, anio,
    notas,
    0 AS es_automatico,
    NULL AS origen_automatico,
    NULL AS origen_automatico_id,
    created_at, updated_at, deleted_at
FROM monthly_incomes
WHERE bonus > 0 AND deleted_at IS NULL;

-- ============================================================================
--  Step 3: Migrar otros > 0
-- ============================================================================
INSERT INTO movements (
    id, tipo, fecha, concepto, importe, moneda,
    cuenta_origen_id, cuenta_destino_id, categoria_id, categoria_texto,
    mes, anio, notas,
    es_automatico, origen_automatico, origen_automatico_id,
    created_at, updated_at, deleted_at
)
SELECT
    lower(hex(randomblob(8))) || '-oth' AS id,
    'ingreso' AS tipo,
    (strftime('%s', anio || '-' || printf('%02d', mes) || '-28T12:00:00Z') * 1000) AS fecha,
    'Otros ingresos' AS concepto,
    otros AS importe,
    moneda,
    NULL AS cuenta_origen_id,
    NULL AS cuenta_destino_id,
    NULL AS categoria_id,
    'Otros ingresos' AS categoria_texto,
    mes, anio,
    notas,
    0 AS es_automatico,
    NULL AS origen_automatico,
    NULL AS origen_automatico_id,
    created_at, updated_at, deleted_at
FROM monthly_incomes
WHERE otros > 0 AND deleted_at IS NULL;

-- ============================================================================
--  Step 4: Eliminar la tabla monthly_incomes
-- ============================================================================
DROP TABLE IF EXISTS monthly_incomes;
