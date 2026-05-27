-- ============================================================================
--  0005_create_recurring_rules.sql
-- ============================================================================
--
--  Crea la tabla recurring_rules.
--  Lote 11a: solo crea la estructura. No migra ni elimina nada todavia.
--  La migracion de monthly_incomes -> reglas se hara en el Lote 11b.
-- ============================================================================

CREATE TABLE `recurring_rules` (
    `id` text PRIMARY KEY NOT NULL,
    `nombre` text NOT NULL,
    `tipo_movimiento` text NOT NULL,
    `importe` real NOT NULL,
    `moneda` text NOT NULL,
    `cuenta_origen_id` text,
    `cuenta_destino_id` text,
    `categoria_id` text,
    `categoria_texto` text,
    `dia_del_mes` integer NOT NULL,
    `fecha_inicio` integer NOT NULL,
    `fecha_fin` integer,
    `activa` integer DEFAULT 1 NOT NULL,
    `origen_automatico` text,
    `origen_automatico_id` text,
    `notas` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `deleted_at` integer,
    CONSTRAINT `recurring_rules_dia_valido` CHECK (`dia_del_mes` BETWEEN 1 AND 31),
    FOREIGN KEY (`moneda`) REFERENCES `currencies`(`code`),
    FOREIGN KEY (`cuenta_origen_id`) REFERENCES `accounts`(`id`),
    FOREIGN KEY (`cuenta_destino_id`) REFERENCES `accounts`(`id`),
    FOREIGN KEY (`categoria_id`) REFERENCES `categories`(`id`)
);

CREATE INDEX `idx_recurring_rules_active`
    ON `recurring_rules` (`activa`, `deleted_at`)
    WHERE `deleted_at` IS NULL;

CREATE INDEX `idx_recurring_rules_origen`
    ON `recurring_rules` (`origen_automatico`, `origen_automatico_id`)
    WHERE `origen_automatico_id` IS NOT NULL;
