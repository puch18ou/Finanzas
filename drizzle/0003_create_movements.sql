-- ============================================================================
--  0003_create_movements.sql — VERSION 2 (sin CHECK problematico)
-- ============================================================================
--
--  Crea la tabla `movements` y migra los datos existentes:
--    - expenses activos     -> movements (tipo='gasto')
--    - extra_incomes activos -> movements (tipo='ingreso')
--
--  CAMBIO RESPECTO A LA V1:
--    Eliminado el CHECK `movements_cuenta_presente` que daba problemas
--    al migrar extra_incomes existentes (que no tienen cuenta destino).
--    La validacion "el movimiento debe tener al menos una cuenta segun
--    su tipo" se delega a la capa de aplicacion (zod en los formularios).
-- ============================================================================

CREATE TABLE `movements` (
    `id` text PRIMARY KEY NOT NULL,
    `tipo` text NOT NULL,
    `fecha` integer NOT NULL,
    `concepto` text NOT NULL,
    `importe` real NOT NULL,
    `moneda` text NOT NULL,
    `cuenta_origen_id` text,
    `cuenta_destino_id` text,
    `categoria_id` text,
    `categoria_texto` text,
    `mes` integer NOT NULL,
    `anio` integer NOT NULL,
    `notas` text,
    `es_automatico` integer DEFAULT 0 NOT NULL,
    `origen_automatico` text,
    `origen_automatico_id` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `movements_mes_valido` CHECK (`mes` BETWEEN 1 AND 12),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`),
    FOREIGN KEY (`cuenta_origen_id`) REFERENCES `accounts`(`id`),
    FOREIGN KEY (`cuenta_destino_id`) REFERENCES `accounts`(`id`),
    FOREIGN KEY (`categoria_id`) REFERENCES `categories`(`id`)
);

CREATE INDEX `idx_movements_anio_mes` ON `movements` (`anio`, `mes`) WHERE `deleted_at` IS NULL;
CREATE INDEX `idx_movements_tipo` ON `movements` (`tipo`) WHERE `deleted_at` IS NULL;
CREATE INDEX `idx_movements_cuenta_origen` ON `movements` (`cuenta_origen_id`) WHERE `deleted_at` IS NULL;
CREATE INDEX `idx_movements_cuenta_destino` ON `movements` (`cuenta_destino_id`) WHERE `deleted_at` IS NULL;
CREATE INDEX `idx_movements_fecha` ON `movements` (`fecha`) WHERE `deleted_at` IS NULL;

-- Migracion de datos: gastos -> movements
INSERT INTO movements (
    id, tipo, fecha, concepto, importe, moneda,
    cuenta_origen_id, cuenta_destino_id, categoria_id, categoria_texto,
    mes, anio, notas,
    es_automatico, origen_automatico, origen_automatico_id,
    created_at, updated_at, deleted_at
)
SELECT
    id, 'gasto', fecha, concepto, importe, moneda,
    cuenta_id AS cuenta_origen_id,
    NULL AS cuenta_destino_id,
    categoria_id,
    NULL AS categoria_texto,
    mes, anio, notas,
    0 AS es_automatico, NULL AS origen_automatico, NULL AS origen_automatico_id,
    created_at, updated_at, deleted_at
FROM expenses
WHERE deleted_at IS NULL;

-- Migracion de datos: extra_incomes -> movements
INSERT INTO movements (
    id, tipo, fecha, concepto, importe, moneda,
    cuenta_origen_id, cuenta_destino_id, categoria_id, categoria_texto,
    mes, anio, notas,
    es_automatico, origen_automatico, origen_automatico_id,
    created_at, updated_at, deleted_at
)
SELECT
    id, 'ingreso', fecha, concepto, importe, moneda,
    NULL AS cuenta_origen_id,
    NULL AS cuenta_destino_id,
    NULL AS categoria_id,
    categoria AS categoria_texto,
    mes, anio, notas,
    0 AS es_automatico, NULL AS origen_automatico, NULL AS origen_automatico_id,
    created_at, updated_at, deleted_at
FROM extra_incomes
WHERE deleted_at IS NULL;
