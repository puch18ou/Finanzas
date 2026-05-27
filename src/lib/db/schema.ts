/**
 * ============================================================================
 *  src/lib/db/schema.ts — Esquema de base de datos (fuente unica de verdad)
 * ============================================================================
 *
 *  Este archivo define todas las tablas de la app. A partir de el, Drizzle:
 *
 *    1. Genera tipos TypeScript automaticos (ver el final del archivo)
 *    2. Genera las migraciones SQL al correr `npm run db:generate`
 *    3. Provee el constructor de queries tipado en los repositories
 *
 *  Regla de oro: NUNCA editar la base de datos manualmente. Para cambiar el
 *  esquema, editas este archivo, corres `npm run db:generate` (genera el SQL
 *  de diff en /drizzle), y al reiniciar la app aplica la migracion sola.
 *
 *  Convenciones:
 *    - Primary keys: TEXT, contiene un UUID v4 generado en cliente con
 *      crypto.randomUUID(). NUNCA autoincrementales (ver ARQUITECTURA seccion 4.3).
 *    - Timestamps: INTEGER en milisegundos desde epoch (Date.now()). Drizzle
 *      tiene el modo 'timestamp_ms' que convierte a/desde Date automaticamente.
 *    - Soft delete: campo `deletedAt`. NULL = activa; con valor = borrada.
 *      Los repositories filtran por defecto las filas con deletedAt no nulo.
 *    - Foreign keys: declaradas con .references() para integridad referencial.
 *      SQLite necesita PRAGMA foreign_keys=ON, que activamos en client.ts.
 * ============================================================================
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================================
//  1. CURRENCIES — catalogo de monedas
// ============================================================================
//
//  Una fila por moneda soportada. La primary key es el codigo ISO 4217
//  (EUR, USD, SGD...) en lugar de un UUID, porque:
//    - Es naturalmente unico
//    - Aparece literalmente en los datos (cada gasto guarda su moneda)
//    - Hace las queries mas legibles al depurar
//
//  Campo clave: `tipoCambioVista`. Es cuantas unidades de "moneda de
//  visualizacion" equivale 1 unidad de esta moneda. Si la moneda vista es
//  EUR, entonces SGD tiene ~0.69 (1 SGD = 0.69 EUR). La moneda vista en
//  si misma siempre vale 1.
//
//  Cuando el usuario cambia la moneda de visualizacion en Settings, este
//  campo se recalcula para todas las monedas (esto sera responsabilidad
//  de un repositorio dedicado en Lote 5).
// ============================================================================
export const currencies = sqliteTable("currencies", {
  // Codigo ISO 4217. Limitado a 3-4 caracteres en la practica.
  code: text("code").primaryKey(),

  nombre: text("nombre").notNull(),
  simbolo: text("simbolo").notNull(),

  // REAL = punto flotante doble. Para tipos de cambio es suficiente.
  // Si en futuro necesitamos mas precision (cripto con 8 decimales),
  // migraremos a TEXT y parseo manual con BigInt. De momento no hace falta.
  tipoCambioVista: real("tipo_cambio_vista").notNull(),

  // Orden de aparicion en selectores. Default 0; las monedas comunes
  // (EUR, USD, SGD del usuario) reciben valores bajos al hacer seed.
  orden: integer("orden").notNull().default(0),

  // SQLite no tiene tipo boolean. Usamos INTEGER con valores 0/1.
  // Drizzle ofrece mode: 'boolean' para que TypeScript lo vea como bool.
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ============================================================================
//  2. SETTINGS — configuracion global (tabla singleton, una sola fila)
// ============================================================================
//
//  Patron "singleton": tabla con primary key fija al valor 'singleton'.
//  Esto impide tener mas de una fila (el CHECK constraint lo refuerza).
//
//  Decision de diseno: lo guardamos en SQL en vez de en un fichero JSON
//  para que los cambios participen del mismo sistema de transacciones
//  y migraciones que el resto. Si manana anadimos un campo nuevo, se
//  beneficia de las migraciones igual que cualquier otra tabla.
//
//  Notar que `categoriaHipotecaId` es referencia logica a categories.id
//  pero no declaramos FK aqui para evitar dependencia circular en el
//  orden de creacion de tablas (categories aun no existe en este punto).
//  El repositorio se asegura de validar la integridad.
// ============================================================================
export const settings = sqliteTable(
  "settings",
  {
    // El CHECK fuerza que solo pueda existir el valor 'singleton'.
    id: text("id").primaryKey(),

    monedaLocal: text("moneda_local")
      .notNull()
      .references(() => currencies.code),
    monedaVista: text("moneda_vista")
      .notNull()
      .references(() => currencies.code),

    anioActual: integer("anio_actual").notNull(),
    mesActual: integer("mes_actual").notNull(),

    // 0.2 = 20% de los ingresos como objetivo de ahorro.
    objetivoAhorroPct: real("objetivo_ahorro_pct").notNull().default(0.2),

    tieneHipoteca: integer("tiene_hipoteca", { mode: "boolean" })
      .notNull()
      .default(false),
    monedaHipoteca: text("moneda_hipoteca").references(() => currencies.code),
    categoriaHipotecaId: text("categoria_hipoteca_id"),

    patrimonioInicial: real("patrimonio_inicial").notNull().default(0),
    patrimonioInicialMoneda: text("patrimonio_inicial_moneda").references(
      () => currencies.code,
    ),

    mostrarFab: integer("mostrar_fab", { mode: "boolean" })
      .notNull()
      .default(true),

    integrarCuotaHipoteca: integer("integrar_cuota_hipoteca", {
      mode: "boolean",
    })
      .notNull()
      .default(false),

    tema: text("tema", { enum: ["light", "dark", "system"] })
      .notNull()
      .default("system"),
    idioma: text("idioma").notNull().default("es"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    // CHECK constraints: garantizan invariantes a nivel BD.
    check("settings_singleton", sql`${t.id} = 'singleton'`),
    check("settings_mes_valido", sql`${t.mesActual} BETWEEN 1 AND 12`),
  ],
);

// ============================================================================
//  3. CATEGORIES — categorias de gasto con presupuesto
// ============================================================================
//
//  El usuario puede crear/editar/borrar categorias libremente. Las que
//  llevan presupuesto > 0 aparecen en el Dashboard con barra de progreso.
//
//  El campo `tipo` es texto libre por flexibilidad, pero los valores
//  esperados son: 'Esencial', 'Ocio', 'Personal', 'Inversion personal',
//  'Variable'. Se podria forzar con un enum, pero el usuario puede querer
//  inventar tipos nuevos en el futuro. Si se vuelve molesto, lo migramos.
// ============================================================================
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),
    tipo: text("tipo").notNull(),

    // Presupuesto mensual EN LA MONEDA indicada en presupuestoMoneda.
    // Tipicamente sera la moneda local del usuario.
    presupuestoMensual: real("presupuesto_mensual").notNull().default(0),
    presupuestoMoneda: text("presupuesto_moneda")
      .notNull()
      .references(() => currencies.code),

    notas: text("notas"),
    orden: integer("orden").notNull().default(0),

    // Opcional: hex de color para que el usuario diferencie en graficos.
    color: text("color"),

    // Opcional: nombre de un icono de lucide-react. Lo metemos en Lote 5+.
    icono: text("icono"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),

    // Soft delete: NULL = activa. Filtrar `WHERE deleted_at IS NULL` en
    // los repos por defecto.
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    // Indice parcial: solo indexa filas activas. Mucho mas eficiente
    // que un indice normal cuando hay muchas filas borradas.
    index("idx_categories_active")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_categories_orden").on(t.orden),
  ],
);

// ============================================================================
//  4. ACCOUNTS — cuentas bancarias, broker, efectivo
// ============================================================================
//
//  El saldo se guarda en la moneda nativa de la cuenta (no convertido).
//  La suma en moneda vista se calcula al leer (capa de dominio).
//
//  El campo `tipo` distingue:
//    - 'Corriente'  — cuenta corriente
//    - 'Ahorro'     — cuenta de ahorro
//    - 'Broker'     — saldo en plataforma de inversion (Trade Republic, etc)
//    - 'Cash'       — efectivo
//    - 'Credito'    — tarjeta de credito (saldo NEGATIVO = deuda)
// ============================================================================
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    entidad: text("entidad").notNull(),
    tipo: text("tipo").notNull(),
    alias: text("alias").notNull(),

    saldo: real("saldo").notNull().default(0),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    activa: integer("activa", { mode: "boolean" }).notNull().default(true),
    notas: text("notas"),
    orden: integer("orden").notNull().default(0),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_accounts_active")
      .on(t.deletedAt, t.activa)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// ============================================================================
//  5. EXPENSES — registro detallado de gastos
// ============================================================================
//
//  La tabla mas voluminosa (puede llegar a decenas de miles de filas).
//  Por eso lleva DENORMALIZACION deliberada: los campos `mes` y `anio` se
//  podrian calcular desde `fecha`, pero los guardamos explicitos para
//  acelerar las queries agregadas que el Dashboard hace constantemente:
//
//    SELECT SUM(importe) FROM expenses WHERE mes=1 AND anio=2026 ...
//
//  Con `mes` y `anio` indexados es O(log n) + scan del rango.
//  Sin denormalizar tendriamos que aplicar funciones MONTH()/YEAR() a
//  la fecha en cada query, lo cual impide usar el indice.
//
//  Esto SI introduce un riesgo: si actualizan `fecha` y olvidan recalcular
//  mes/anio, queda inconsistente. La capa de dominio (en Lote 4) tendra
//  una funcion helper que siempre los pone juntos.
// ============================================================================
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),

    // Timestamp en ms. Representa una fecha sin hora (poner 00:00 UTC).
    fecha: integer("fecha", { mode: "timestamp_ms" }).notNull(),
    concepto: text("concepto").notNull(),

    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categories.id),

    importe: real("importe").notNull(),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    // Opcional: de que cuenta salio el dinero. Permite restar al saldo
    // cuando lleguemos a la fase de conciliacion automatica de cuentas.
    cuentaId: text("cuenta_id").references(() => accounts.id),

    // Denormalizados desde `fecha` (ver bloque de comentarios arriba):
    mes: integer("mes").notNull(),
    anio: integer("anio").notNull(),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    // Indice para "todos los gastos del mes X del anio Y" — la consulta
    // mas frecuente del Dashboard.
    index("idx_expenses_anio_mes")
      .on(t.anio, t.mes)
      .where(sql`${t.deletedAt} IS NULL`),

    // Indice para "todos los gastos de la categoria C en el mes/anio actual"
    index("idx_expenses_categoria")
      .on(t.categoriaId)
      .where(sql`${t.deletedAt} IS NULL`),

    // Indice para listar gastos por fecha descendente (pantalla principal).
    index("idx_expenses_fecha")
      .on(t.fecha)
      .where(sql`${t.deletedAt} IS NULL`),

    check("expenses_importe_no_neg", sql`${t.importe} >= 0`),
    check("expenses_mes_valido", sql`${t.mes} BETWEEN 1 AND 12`),
  ],
);

// ============================================================================
//  6. MONTHLY_INCOMES — ingresos mensuales fijos (salario, etc)
// ============================================================================
//
//  Una fila por (anio, mes). El UNIQUE evita duplicados.
//
//  Patron de uso: al cambiar de anio o al iniciar la app, el repo se asegura
//  de que existan las 12 filas del anio actual (las crea con valores 0 si
//  no existen). El usuario edita salario/bonus/otros.
// ============================================================================
export const monthlyIncomes = sqliteTable(
  "monthly_incomes",
  {
    id: text("id").primaryKey(),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),

    salario: real("salario").notNull().default(0),
    bonus: real("bonus").notNull().default(0),
    otros: real("otros").notNull().default(0),

    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    // El UNIQUE impide tener dos filas para el mismo (anio, mes).
    uniqueIndex("ux_monthly_incomes_anio_mes").on(t.anio, t.mes),
    check("monthly_incomes_mes_valido", sql`${t.mes} BETWEEN 1 AND 12`),
  ],
);

// ============================================================================
//  7. EXTRA_INCOMES — ingresos puntuales (bonus extra, premios, regalos)
// ============================================================================
//
//  Misma logica que expenses pero para ingresos. Se suman al total mensual
//  del Dashboard (junto a monthlyIncomes).
// ============================================================================
export const extraIncomes = sqliteTable(
  "extra_incomes",
  {
    id: text("id").primaryKey(),

    fecha: integer("fecha", { mode: "timestamp_ms" }).notNull(),
    concepto: text("concepto").notNull(),

    // Texto libre. Valores tipicos: 'Bonus', 'Premio', 'Regalo', 'Reembolso'.
    categoria: text("categoria").notNull(),

    tipo: text("tipo").notNull().default("Ingreso extra"),

    importe: real("importe").notNull(),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    mes: integer("mes").notNull(),
    anio: integer("anio").notNull(),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_extra_incomes_anio_mes")
      .on(t.anio, t.mes)
      .where(sql`${t.deletedAt} IS NULL`),
    check("extra_incomes_mes_valido", sql`${t.mes} BETWEEN 1 AND 12`),
  ],
);

// ============================================================================
//  8. INVESTMENTS — cartera (acciones, ETFs, fondos, crypto)
// ============================================================================
//
//  El P/L (profit/loss) NO se guarda: se calcula al vuelo desde
//  participaciones * (precio_actual - precio_compra). Pertenece a la
//  capa de dominio, no a la BD.
//
//  El campo `precioActual` se actualiza:
//    - Manualmente: edicion del usuario (Fase A)
//    - Automaticamente: tarea periodica via API (Yahoo, Alpha Vantage)
//      — esto es una decision pendiente (ver ARQUITECTURA seccion 9).
// ============================================================================
export const investments = sqliteTable(
  "investments",
  {
    id: text("id").primaryKey(),

    // 'Accion', 'Fondo', 'ETF', 'Crypto', 'Bono', 'Otro'
    tipo: text("tipo").notNull(),
    ticker: text("ticker"),
    nombre: text("nombre").notNull(),

    participaciones: real("participaciones").notNull(),
    precioCompra: real("precio_compra").notNull(),
    precioActual: real("precio_actual").notNull(),

    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    fechaCompra: integer("fecha_compra", { mode: "timestamp_ms" }),

    cuentaId: text("cuenta_id").references(() => accounts.id),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_investments_active")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "investments_cantidad_no_neg",
      sql`${t.participaciones} >= 0 AND ${t.precioCompra} >= 0 AND ${t.precioActual} >= 0`,
    ),
  ],
);

// ============================================================================
//  9. GOALS — metas de ahorro con fecha objetivo
// ============================================================================
//
//  El campo `cuentaVinculadaId` permite (en el futuro) que la meta se actualice
//  automaticamente con el saldo de una cuenta concreta — por ejemplo, una
//  cuenta de ahorro dedicada a "Entrada de piso". De momento se rellena a mano.
// ============================================================================
export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),

    nombre: text("nombre").notNull(),
    importeObjetivo: real("importe_objetivo").notNull(),
    yaAhorrado: real("ya_ahorrado").notNull().default(0),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    fechaObjetivo: integer("fecha_objetivo", {
      mode: "timestamp_ms",
    }).notNull(),

    cuentaVinculadaId: text("cuenta_vinculada_id").references(
      () => accounts.id,
    ),

    notas: text("notas"),
    completada: integer("completada", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_goals_active")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "goals_importes_validos",
      sql`${t.importeObjetivo} > 0 AND ${t.yaAhorrado} >= 0`,
    ),
  ],
);

// ============================================================================
// 10. MORTGAGE — hipoteca (singleton por ahora)
// ============================================================================
//
//  Diseno actual: una sola hipoteca activa, tabla casi-singleton.
//  Decision: dejamos `id` como text en lugar de forzar 'singleton', porque
//  en el futuro podemos necesitar guardar el historial de refinanciaciones
//  como filas separadas (solo una con activa=true).
//
//  La cuota mensual NO se guarda: se calcula al vuelo via PMT en la capa
//  de dominio. Asi, si cambias el TIN, todo se recalcula automaticamente.
//  Lo mismo con la tabla de amortizacion completa.
// ============================================================================
export const mortgage = sqliteTable("mortgage", {
  id: text("id").primaryKey(),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),

  precioVivienda: real("precio_vivienda").notNull(),
  entrada: real("entrada").notNull(),
  gastosAsociados: real("gastos_asociados").notNull().default(0),

  // Anios totales de plazo (e.g. 25).
  plazoAnios: integer("plazo_anios").notNull(),

  // TIN anual como decimal. 0.032 = 3.2%.
  tin: real("tin").notNull(),

  tipo: text("tipo", { enum: ["Fija", "Variable", "Mixta"] }).notNull(),

  // Solo aplica si tipo es Variable o Mixta.
  diferencial: real("diferencial").notNull().default(0),
  tipoReferencia: real("tipo_referencia").notNull().default(0),

  // Solo aplica si tipo es Mixta.
  aniosTipoFijo: integer("anios_tipo_fijo").notNull().default(0),

  moneda: text("moneda")
    .notNull()
    .references(() => currencies.code),

  fechaInicio: integer("fecha_inicio", { mode: "timestamp_ms" }).notNull(),

  notas: text("notas"),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

// ============================================================================
// 11. OTHER_DEBTS — prestamos consumo, coche, tarjetas
// ============================================================================
export const otherDebts = sqliteTable(
  "other_debts",
  {
    id: text("id").primaryKey(),

    concepto: text("concepto").notNull(),
    tipo: text("tipo").notNull(), // 'Auto', 'Tarjeta', 'Consumo', 'Personal'

    importeInicial: real("importe_inicial").notNull(),
    capitalPendiente: real("capital_pendiente").notNull(),

    tin: real("tin").notNull(),

    plazoRestanteMeses: integer("plazo_restante_meses").notNull(),

    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    fechaInicio: integer("fecha_inicio", { mode: "timestamp_ms" }),
    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_other_debts_active")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "other_debts_valores_validos",
      sql`${t.capitalPendiente} >= 0 AND ${t.plazoRestanteMeses} >= 0`,
    ),
  ],
);

// ============================================================================
// 12. SYNC_LOG — cola de operaciones para sincronizar (preparada para Fase C)
// ============================================================================
//
//  En Fase A esta tabla NO se rellena. Existe en el esquema desde el dia uno
//  porque anadirla en Fase C requeriria una migracion sobre BDs ya en uso.
//  Cuesta cero tenerla vacia.
//
//  Cuando lleguemos a Fase C, cada operacion (insert/update/delete) sobre
//  cualquier tabla genera tambien una fila en sync_log con el payload JSON.
//  Un worker periodico drena esta cola contra el servidor (Turso).
// ============================================================================
export const syncLog = sqliteTable(
  "sync_log",
  {
    id: text("id").primaryKey(),
    tabla: text("tabla").notNull(),
    registroId: text("registro_id").notNull(),

    operacion: text("operacion", {
      enum: ["insert", "update", "delete"],
    }).notNull(),

    // JSON serializado con los datos. Lo tipamos como `text` y deserializamos
    // en aplicacion. Drizzle tiene mode: 'json' pero produce sintaxis menos
    // controlable; preferimos manual.
    payload: text("payload"),

    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),

    sincronizado: integer("sincronizado", { mode: "boolean" })
      .notNull()
      .default(false),

    sincronizadoAt: integer("sincronizado_at", { mode: "timestamp_ms" }),

    intentos: integer("intentos").notNull().default(0),
    ultimoError: text("ultimo_error"),
  },
  (t) => [
    // Indice parcial: solo las pendientes. Cuando se sincronizan, salen del
    // indice (lo cual es lo que quieres para que el worker sea eficiente).
    index("idx_sync_log_pending")
      .on(t.sincronizado, t.timestamp)
      .where(sql`${t.sincronizado} = 0`),
  ],
);

// ============================================================================
// 13. MOVEMENTS — gastos, ingresos, transferencias, ajustes unificados
// ============================================================================
//
//  Tabla central de Fase 2. Modela todos los cambios de saldo como una
//  unica entidad con campo `tipo` que discrimina el comportamiento.
//
//  Tipos: gasto, ingreso, transferencia, ajuste, intereses, cuota
//  El importe siempre es POSITIVO. El signo lo determina el tipo y
//  qué cuenta es origen/destino.
//
//  CHECK: al menos una cuenta presente, excepto ingreso (compatibilidad
//  con extraIncomes que no tenian cuenta).
// ============================================================================
export const movements = sqliteTable(
  "movements",
  {
    id: text("id").primaryKey(),

    tipo: text("tipo", {
      enum: [
        "gasto",
        "ingreso",
        "transferencia",
        "ajuste",
        "intereses",
        "cuota",
      ],
    }).notNull(),

    fecha: integer("fecha", { mode: "timestamp_ms" }).notNull(),
    concepto: text("concepto").notNull(),

    importe: real("importe").notNull(),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    cuentaOrigenId: text("cuenta_origen_id").references(() => accounts.id),
    cuentaDestinoId: text("cuenta_destino_id").references(() => accounts.id),

    categoriaId: text("categoria_id").references(() => categories.id),
    categoriaTexto: text("categoria_texto"),

    mes: integer("mes").notNull(),
    anio: integer("anio").notNull(),

    notas: text("notas"),

    esAutomatico: integer("es_automatico", { mode: "boolean" })
      .notNull()
      .default(false),
    origenAutomatico: text("origen_automatico", {
      enum: ["mortgage", "debt", "interest"],
    }),
    origenAutomaticoId: text("origen_automatico_id"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_movements_anio_mes")
      .on(t.anio, t.mes)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_movements_tipo")
      .on(t.tipo)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_movements_cuenta_origen")
      .on(t.cuentaOrigenId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_movements_cuenta_destino")
      .on(t.cuentaDestinoId)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_movements_fecha")
      .on(t.fecha)
      .where(sql`${t.deletedAt} IS NULL`),

    check("movements_mes_valido", sql`${t.mes} BETWEEN 1 AND 12`),
  ],
);

// ============================================================================
//  TIPOS AUTOMATICOS — Drizzle infiere los tipos TypeScript del esquema
// ============================================================================
//
//  Para cada tabla generamos dos tipos:
//    - `<Tabla>Row`: como sale la fila al hacer SELECT (con createdAt:Date)
//    - `New<Tabla>`: como hay que pasarla al INSERT (createdAt opcional si
//      tiene default; nullables se permiten null; etc)
//
//  Estos tipos son LA BASE de los repositories y de toda la app. Si anades
//  una columna al esquema, los tipos se actualizan automaticamente y
//  TypeScript te marca en rojo todos los sitios donde tienes que adaptar.
// ============================================================================

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type MonthlyIncome = typeof monthlyIncomes.$inferSelect;
export type NewMonthlyIncome = typeof monthlyIncomes.$inferInsert;

export type ExtraIncome = typeof extraIncomes.$inferSelect;
export type NewExtraIncome = typeof extraIncomes.$inferInsert;

export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

export type Mortgage = typeof mortgage.$inferSelect;
export type NewMortgage = typeof mortgage.$inferInsert;

export type OtherDebt = typeof otherDebts.$inferSelect;
export type NewOtherDebt = typeof otherDebts.$inferInsert;

export type SyncLog = typeof syncLog.$inferSelect;
export type NewSyncLog = typeof syncLog.$inferInsert;

export type Movement = typeof movements.$inferSelect;
export type NewMovement = typeof movements.$inferInsert;
