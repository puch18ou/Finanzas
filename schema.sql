-- ============================================================================
--  Finanzas App — Esquema SQL completo
--  Dialecto: SQLite (compatible con Tauri SQL plugin y SQLite WASM)
--  Versión: 1.0 — 26 de mayo de 2026
-- ============================================================================
--
--  Convenciones:
--    · Todas las primary keys son TEXT (UUID v4 generado en cliente)
--    · Todos los timestamps son INTEGER (milisegundos desde epoch UTC)
--    · Importes en REAL (suficiente precisión para finanzas personales)
--    · deleted_at NULL = activa; con valor = soft-deleted
--    · ON UPDATE CASCADE no existe en SQLite; se gestiona en aplicación
-- ============================================================================


-- ============================================================================
--  1. CURRENCIES — catálogo de monedas y tipos de cambio
-- ============================================================================
CREATE TABLE currencies (
    code                    TEXT PRIMARY KEY,           -- 'EUR', 'SGD', 'USD'…
    nombre                  TEXT NOT NULL,
    simbolo                 TEXT NOT NULL,
    tipo_cambio_vista       REAL NOT NULL,              -- unidades de moneda-vista por 1 unidad de esta
    orden                   INTEGER NOT NULL DEFAULT 0,
    activa                  INTEGER NOT NULL DEFAULT 1, -- 0/1
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL
);


-- ============================================================================
--  2. SETTINGS — configuración global (una sola fila)
-- ============================================================================
CREATE TABLE settings (
    id                          TEXT PRIMARY KEY CHECK (id = 'singleton'),
    moneda_local                TEXT NOT NULL REFERENCES currencies(code),
    moneda_vista                TEXT NOT NULL REFERENCES currencies(code),
    anio_actual                 INTEGER NOT NULL,
    mes_actual                  INTEGER NOT NULL CHECK (mes_actual BETWEEN 1 AND 12),
    objetivo_ahorro_pct         REAL NOT NULL DEFAULT 0.2,
    tiene_hipoteca              INTEGER NOT NULL DEFAULT 0,
    moneda_hipoteca             TEXT REFERENCES currencies(code),
    categoria_hipoteca_id       TEXT,                       -- FK lógico a categories.id
    patrimonio_inicial          REAL NOT NULL DEFAULT 0,
    patrimonio_inicial_moneda   TEXT REFERENCES currencies(code),
    tema                        TEXT NOT NULL DEFAULT 'system' CHECK (tema IN ('light','dark','system')),
    idioma                      TEXT NOT NULL DEFAULT 'es',
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL
);


-- ============================================================================
--  3. CATEGORIES — categorías de gasto con presupuesto mensual
-- ============================================================================
CREATE TABLE categories (
    id                      TEXT PRIMARY KEY,
    nombre                  TEXT NOT NULL,
    tipo                    TEXT NOT NULL,              -- 'Esencial', 'Ocio', 'Personal', 'Inversión personal', 'Variable'
    presupuesto_mensual     REAL NOT NULL DEFAULT 0,
    presupuesto_moneda      TEXT NOT NULL REFERENCES currencies(code),
    notas                   TEXT,
    orden                   INTEGER NOT NULL DEFAULT 0,
    color                   TEXT,                       -- hex opcional para gráficos
    icono                   TEXT,                       -- nombre de icono lucide
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_categories_active ON categories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_orden ON categories(orden);


-- ============================================================================
--  4. ACCOUNTS — cuentas bancarias, broker, efectivo
-- ============================================================================
CREATE TABLE accounts (
    id                      TEXT PRIMARY KEY,
    entidad                 TEXT NOT NULL,              -- 'DBS', 'BBVA'…
    tipo                    TEXT NOT NULL,              -- 'Corriente', 'Ahorro', 'Broker', 'Cash', 'Crédito'
    alias                   TEXT NOT NULL,
    saldo                   REAL NOT NULL DEFAULT 0,
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    activa                  INTEGER NOT NULL DEFAULT 1,
    notas                   TEXT,
    orden                   INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_accounts_active ON accounts(deleted_at, activa) WHERE deleted_at IS NULL;


-- ============================================================================
--  5. EXPENSES — registro detallado de gastos
-- ============================================================================
CREATE TABLE expenses (
    id                      TEXT PRIMARY KEY,
    fecha                   INTEGER NOT NULL,           -- timestamp ms (representa fecha sin hora)
    concepto                TEXT NOT NULL,
    categoria_id            TEXT NOT NULL REFERENCES categories(id),
    importe                 REAL NOT NULL CHECK (importe >= 0),
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    cuenta_id               TEXT REFERENCES accounts(id),
    -- Campos derivados (denormalizados para acelerar SUMIFS por mes/año):
    mes                     INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio                    INTEGER NOT NULL,
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_expenses_anio_mes      ON expenses(anio, mes)        WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_categoria     ON expenses(categoria_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_fecha         ON expenses(fecha DESC)       WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_cuenta        ON expenses(cuenta_id)        WHERE deleted_at IS NULL AND cuenta_id IS NOT NULL;


-- ============================================================================
--  6. MONTHLY_INCOMES — ingresos mensuales (12 filas/año típicamente)
-- ============================================================================
CREATE TABLE monthly_incomes (
    id                      TEXT PRIMARY KEY,
    anio                    INTEGER NOT NULL,
    mes                     INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    salario                 REAL NOT NULL DEFAULT 0,
    bonus                   REAL NOT NULL DEFAULT 0,
    otros                   REAL NOT NULL DEFAULT 0,
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER,
    UNIQUE(anio, mes)
);
CREATE INDEX idx_monthly_incomes_anio   ON monthly_incomes(anio)      WHERE deleted_at IS NULL;


-- ============================================================================
--  7. EXTRA_INCOMES — ingresos puntuales (premios, bonus extra)
-- ============================================================================
CREATE TABLE extra_incomes (
    id                      TEXT PRIMARY KEY,
    fecha                   INTEGER NOT NULL,
    concepto                TEXT NOT NULL,
    categoria               TEXT NOT NULL,              -- texto libre: 'Bonus', 'Premio', 'Regalo'…
    tipo                    TEXT NOT NULL DEFAULT 'Ingreso extra',
    importe                 REAL NOT NULL,
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    mes                     INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio                    INTEGER NOT NULL,
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_extra_incomes_anio_mes ON extra_incomes(anio, mes) WHERE deleted_at IS NULL;


-- ============================================================================
--  8. INVESTMENTS — cartera (acciones, ETFs, fondos)
-- ============================================================================
CREATE TABLE investments (
    id                      TEXT PRIMARY KEY,
    tipo                    TEXT NOT NULL,              -- 'Acción', 'Fondo', 'ETF', 'Crypto', 'Bono', 'Otro'
    ticker                  TEXT,                       -- AAPL, MSFT, ISIN…
    nombre                  TEXT NOT NULL,
    participaciones         REAL NOT NULL CHECK (participaciones >= 0),
    precio_compra           REAL NOT NULL CHECK (precio_compra >= 0),
    precio_actual           REAL NOT NULL CHECK (precio_actual >= 0),
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    fecha_compra            INTEGER,
    cuenta_id               TEXT REFERENCES accounts(id),
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_investments_active ON investments(deleted_at) WHERE deleted_at IS NULL;


-- ============================================================================
--  9. GOALS — metas de ahorro con fecha objetivo
-- ============================================================================
CREATE TABLE goals (
    id                      TEXT PRIMARY KEY,
    nombre                  TEXT NOT NULL,
    importe_objetivo        REAL NOT NULL CHECK (importe_objetivo > 0),
    ya_ahorrado             REAL NOT NULL DEFAULT 0 CHECK (ya_ahorrado >= 0),
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    fecha_objetivo          INTEGER NOT NULL,
    cuenta_vinculada_id     TEXT REFERENCES accounts(id),  -- opcional: la meta crece con esta cuenta
    notas                   TEXT,
    completada              INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_goals_active ON goals(deleted_at) WHERE deleted_at IS NULL;


-- ============================================================================
-- 10. MORTGAGE — hipoteca (singleton de momento; preparada para histórico)
-- ============================================================================
CREATE TABLE mortgage (
    id                      TEXT PRIMARY KEY,           -- singleton fijo o ID si pasamos a múltiples
    activa                  INTEGER NOT NULL DEFAULT 1,
    precio_vivienda         REAL NOT NULL,
    entrada                 REAL NOT NULL,
    gastos_asociados        REAL NOT NULL DEFAULT 0,
    plazo_anios             INTEGER NOT NULL CHECK (plazo_anios > 0),
    tin                     REAL NOT NULL,              -- tipo interés nominal anual (0.032 = 3.2%)
    tipo                    TEXT NOT NULL CHECK (tipo IN ('Fija','Variable','Mixta')),
    diferencial             REAL NOT NULL DEFAULT 0,
    tipo_referencia         REAL NOT NULL DEFAULT 0,    -- euríbor o similar
    anios_tipo_fijo         INTEGER NOT NULL DEFAULT 0,
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    fecha_inicio            INTEGER NOT NULL,
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);


-- ============================================================================
-- 11. OTHER_DEBTS — préstamos consumo, coche, tarjetas
-- ============================================================================
CREATE TABLE other_debts (
    id                      TEXT PRIMARY KEY,
    concepto                TEXT NOT NULL,
    tipo                    TEXT NOT NULL,              -- 'Auto', 'Tarjeta', 'Consumo', 'Personal'
    importe_inicial         REAL NOT NULL,
    capital_pendiente       REAL NOT NULL CHECK (capital_pendiente >= 0),
    tin                     REAL NOT NULL,
    plazo_restante_meses    INTEGER NOT NULL CHECK (plazo_restante_meses >= 0),
    moneda                  TEXT NOT NULL REFERENCES currencies(code),
    fecha_inicio            INTEGER,
    notas                   TEXT,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER
);
CREATE INDEX idx_other_debts_active ON other_debts(deleted_at) WHERE deleted_at IS NULL;


-- ============================================================================
-- 12. SYNC_LOG — cola de operaciones para sincronizar (Fase C)
--     En Fase A se rellena pero no se usa. La estructura está lista.
-- ============================================================================
CREATE TABLE sync_log (
    id                      TEXT PRIMARY KEY,
    tabla                   TEXT NOT NULL,              -- 'expenses', 'accounts'…
    registro_id             TEXT NOT NULL,
    operacion               TEXT NOT NULL CHECK (operacion IN ('insert','update','delete')),
    payload                 TEXT,                       -- JSON con los datos
    timestamp               INTEGER NOT NULL,
    sincronizado            INTEGER NOT NULL DEFAULT 0,
    sincronizado_at         INTEGER,
    intentos                INTEGER NOT NULL DEFAULT 0,
    ultimo_error            TEXT
);
CREATE INDEX idx_sync_log_pending ON sync_log(sincronizado, timestamp) WHERE sincronizado = 0;


-- ============================================================================
--  SEED — datos iniciales mínimos
--  (Estos INSERTs se ejecutan al inicializar la base de datos por primera vez)
-- ============================================================================

-- Las monedas y categorías se insertan desde TypeScript en seed.ts, pero a
-- modo de referencia, este sería el contenido mínimo:
--
-- INSERT INTO currencies (code, nombre, simbolo, tipo_cambio_vista, orden, …)
-- VALUES
--   ('EUR', 'Euro', '€', 1.0, 0, …),
--   ('SGD', 'Dólar de Singapur', 'S$', 0.69, 1, …),
--   ('USD', 'Dólar estadounidense', '$', 0.92, 2, …),
--   ...
--
-- INSERT INTO categories (id, nombre, tipo, presupuesto_mensual, …)
-- VALUES
--   (<uuid>, 'Vivienda', 'Esencial', 2200, …),
--   (<uuid>, 'Suministros', 'Esencial', 250, …),
--   ...

-- Fin del esquema.
