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

    // Lote 14b: objetivo de ahorro en importe fijo (€/mes) en moneda local.
    // 0 = sin objetivo de importe (solo se usa el %).
    objetivoAhorroImporte: real("objetivo_ahorro_importe")
      .notNull()
      .default(0),

    // Fecha "desde cuando" la meta de ahorro es efectiva. NULL = desde
    // siempre. Aplica al % y al importe. La SavingsRateCard descarta los
    // meses anteriores en la media y la tira de cumplimiento.
    objetivoAhorroDesde: integer("objetivo_ahorro_desde", {
      mode: "timestamp_ms",
    }),

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

    // Lote 10b-3: cuenta por defecto para precargar nuevos movimientos.
    cuentaPorDefectoId: text("cuenta_por_defecto_id"),

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

    // Lote 10b: saldo de PARTIDA. El saldo actual se calcula como
    // saldoInicial + impacto neto de los movimientos (ver domain/accounts).
    saldoInicial: real("saldo_inicial").notNull().default(0),
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
    // ISIN (12 caracteres). Identificador del activo; se usa para resolver el
    // simbolo de cotizacion. Opcional.
    isin: text("isin"),
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

    // Lote 13b-2: posicion archivada (cerrada, valor 0). Fuera de la vista
    // activa/KPIs pero conservada por historial. Distinto de deletedAt.
    archivada: integer("archivada", { mode: "boolean" })
      .notNull()
      .default(false),

    // Lote 16: TAE automatica (solo para "Cuenta remunerada"). El servicio
    // aplica los intereses pendientes al arrancar y actualiza precioActual.
    tasaInteres: real("tasa_interes"),
    frecuenciaInteres: text("frecuencia_interes"), // 'mensual' | 'trimestral' | 'anual'
    interesCompuesto: integer("interes_compuesto", { mode: "boolean" }),
    ultimoInteresAplicado: integer("ultimo_interes_aplicado", {
      mode: "timestamp_ms",
    }),

    // Fase cotizaciones: ultima vez que se actualizo precioActual desde una
    // API de cotizacion (NULL = nunca, o solo manual).
    ultimaActualizacionPrecio: integer("ultima_actualizacion_precio", {
      mode: "timestamp_ms",
    }),

    // Para fondos "por dinero" (sin unidades): ultimo valor liquidativo (VL)
    // visto al cotizar, en la moneda del activo. Informativo. NULL = sin VL aun.
    ultimaCotizacionNav: real("ultima_cotizacion_nav"),

    // Participaciones REALES del usuario para valorar un fondo por su VL:
    // valor = unidadesCotizacion * VL. Independiente de `participaciones` (que
    // en modo dinero guarda el importe). NULL = no cotizar por unidades.
    unidadesCotizacion: real("unidades_cotizacion"),

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

  cuentaPagoId: text("cuenta_pago_id").references(() => accounts.id),

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

    cuentaPagoId: text("cuenta_pago_id").references(() => accounts.id),

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
        "devolucion",
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

    // Etiquetas (tags) transversales, lista separada por comas y normalizada
    // (minusculas). Una 2a dimension ademas de la categoria. Ver domain/tags.
    etiquetas: text("etiquetas"),

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
//  investmentContributions — APORTACIONES a una inversion (Lote 13)
// ============================================================================
//
//  Historial de aportaciones de una inversion. Cada fila es una compra de
//  `participaciones` a `precioUnitario` en una fecha. La moneda se hereda de
//  la inversion (no se repite aqui).
//
//  El total de participaciones y el coste medio ponderado de la inversion se
//  recalculan desde aqui, pero se mantienen CACHEADOS en investments para no
//  romper a los consumidores existentes (ver investment-contribution-service).
//
//  movimientoId: si la aportacion descuenta de una cuenta, apunta al movement
//  (transferencia) creado; al borrar la aportacion, se borra ese movimiento.
// ============================================================================
export const investmentContributions = sqliteTable(
  "investment_contributions",
  {
    id: text("id").primaryKey(),

    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id),

    fecha: integer("fecha", { mode: "timestamp_ms" }).notNull(),

    participaciones: real("participaciones").notNull(),
    precioUnitario: real("precio_unitario").notNull(),
    // Lote 17: comision aplicada en la operacion (compra o venta). En modo
    // broker se suma al coste total (sube el coste medio) o reduce el efectivo
    // recibido en una retirada.
    comision: real("comision").notNull().default(0),

    // Plusvalia/minusvalia REALIZADA en una retirada (venta): dinero recibido
    // bruto - coste de las participaciones vendidas, en la moneda de la
    // inversion. null en aportaciones. Ver domain/investments.realizedGain.
    plusvaliaRealizada: real("plusvalia_realizada"),

    cuentaOrigenId: text("cuenta_origen_id").references(() => accounts.id),
    movimientoId: text("movimiento_id").references(() => movements.id),

    // false = aportacion (compra); true = retirada (reembolso/venta). El
    // recalculo de totales resta las retiradas.
    esRetirada: integer("es_retirada", { mode: "boolean" })
      .notNull()
      .default(false),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_inv_contrib_investment")
      .on(t.investmentId)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "inv_contrib_no_neg",
      sql`${t.participaciones} >= 0 AND ${t.precioUnitario} >= 0`,
    ),
  ],
);

// ============================================================================
//  BLOQUE recurringRules
// ============================================================================
//
//  Reglas para movements que se generan automaticamente cada mes:
//    - Salario y otros ingresos fijos
//    - Cuota mensual de hipoteca/deudas (vinculadas en Lote 11c)
//    - Intereses de cuenta remunerada (vinculados en Lote 11c)
//    - Cualquier otra cosa periodica (alquiler, suscripciones, etc.)
//
//  El servicio RecurringService usa esta tabla para generar movements al
//  arrancar la app si detecta meses pendientes.
//
//  CAMPOS CLAVE
//  ------------
//    diaDelMes: 1-31. Si el mes no tiene ese dia (e.g. 31 en febrero),
//               se hace clamp al ultimo dia del mes en el servicio.
//    fechaInicio: primer mes a partir del cual la regla aplica.
//    fechaFin: ultimo mes en el que aplica (inclusive). NULL = indefinido.
//    activa: toggle on/off sin tener que borrar la regla.
//    origenAutomatico: identifica reglas creadas por el sistema:
//      - 'mortgage': vinculada a una hipoteca (cuota mensual)
//      - 'debt': vinculada a un prestamo personal/coche
//      - 'interest': vinculada a una cuenta remunerada
//      - NULL: regla manual creada por el usuario
//    origenAutomaticoId: id de la entidad que la origina (mortgage.id,
//      otherDebts.id, accounts.id). NULL si es manual.
//
//  TIPOS DE MOVIMIENTO PERMITIDOS
//  ------------------------------
//  El campo tipoMovimiento se usara cuando el servicio genere el movement.
//  Para reglas manuales, solo permitimos los tipos basicos:
//    'gasto' | 'ingreso' | 'transferencia'
//  Para reglas vinculadas (en Lote 11c) tambien se usaran:
//    'cuota' (hipoteca/deuda) | 'intereses' (cuenta remunerada)
// ============================================================================

export const recurringRules = sqliteTable(
  "recurring_rules",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),

    tipoMovimiento: text("tipo_movimiento", {
      enum: ["gasto", "ingreso", "transferencia", "cuota", "intereses"],
    }).notNull(),

    importe: real("importe").notNull(),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    cuentaOrigenId: text("cuenta_origen_id").references(() => accounts.id),
    cuentaDestinoId: text("cuenta_destino_id").references(() => accounts.id),

    categoriaId: text("categoria_id").references(() => categories.id),
    categoriaTexto: text("categoria_texto"),

    diaDelMes: integer("dia_del_mes").notNull(),
    fechaInicio: integer("fecha_inicio", { mode: "timestamp_ms" }).notNull(),
    fechaFin: integer("fecha_fin", { mode: "timestamp_ms" }),

    // Frecuencia (Lote 13b-2). 'mensual' por defecto (compatibilidad con todas
    // las reglas existentes, que usan diaDelMes). 'semanal' usa diaSemana
    // (0=domingo..6=sabado); 'diaria' no usa ninguno. Solo lo honra el
    // generador de aportaciones periodicas a inversiones.
    frecuencia: text("frecuencia", {
      enum: ["diaria", "semanal", "mensual"],
    })
      .notNull()
      .default("mensual"),
    diaSemana: integer("dia_semana"),

    activa: integer("activa", { mode: "boolean" }).notNull().default(true),

    // 'investment' (Lote 13b-2): regla de aportacion periodica a una inversion.
    // No la genera RecurringService (la genera InvestmentContributionService,
    // que ademas crea la fila de aportacion y recalcula los totales).
    origenAutomatico: text("origen_automatico", {
      enum: ["mortgage", "debt", "interest", "investment"],
    }),
    origenAutomaticoId: text("origen_automatico_id"),

    notas: text("notas"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_recurring_rules_active")
      .on(t.activa, t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),

    // Indice util para la query "que reglas tiene este origen" (al borrar
    // una hipoteca/deuda en Lote 11c borraremos sus reglas vinculadas).
    index("idx_recurring_rules_origen")
      .on(t.origenAutomatico, t.origenAutomaticoId)
      .where(sql`${t.origenAutomaticoId} IS NOT NULL`),

    check("recurring_rules_dia_valido", sql`${t.diaDelMes} BETWEEN 1 AND 31`),
  ],
);

// ============================================================================
//  objetivoAhorroTramos — OBJETIVO DE AHORRO CON VIGENCIA (tramos)
// ============================================================================
//
//  Sustituye al valor unico de settings.objetivoAhorroPct/Importe/Desde por
//  una linea temporal de tramos. Para un mes M, el objetivo vigente es el
//  tramo con mayor `desde` <= M (ver domain/tramos.resolveTramo).
//
//  CONVENCION DE LA FECHA "DESDE"
//  ------------------------------
//    - desdeAnio + desdeMes = primer mes en que aplica el tramo.
//    - desdeAnio=NULL y desdeMes=NULL = tramo BASE "desde siempre" (cuenta
//      como -infinito; cubre todos los meses hasta el siguiente tramo). Debe
//      haber como mucho UN tramo base.
//
//  Ambos objetivos (pct e importe) son opcionales por tramo: 0 = sin objetivo
//  en esa metrica. El importe esta en la `moneda` indicada (tipicamente la
//  moneda local del usuario).
// ============================================================================
export const objetivoAhorroTramos = sqliteTable(
  "objetivo_ahorro_tramos",
  {
    id: text("id").primaryKey(),

    desdeAnio: integer("desde_anio"),
    desdeMes: integer("desde_mes"),

    pct: real("pct").notNull().default(0),
    importe: real("importe").notNull().default(0),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_objetivo_tramos_active")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "objetivo_tramos_mes_valido",
      sql`${t.desdeMes} IS NULL OR ${t.desdeMes} BETWEEN 1 AND 12`,
    ),
  ],
);

// ============================================================================
//  presupuestoTramos — PRESUPUESTO DE CATEGORIA CON VIGENCIA (tramos)
// ============================================================================
//
//  Sustituye al valor unico de categories.presupuestoMensual/Moneda por una
//  linea temporal por categoria. Para un mes M, el presupuesto vigente de una
//  categoria es el tramo con mayor `desde` <= M (misma resolucion que el
//  objetivo de ahorro). Util cuando cambia el alquiler, una suscripcion, etc.
//
//    - desdeAnio + desdeMes = primer mes en que aplica el tramo.
//    - desdeAnio=NULL y desdeMes=NULL = tramo BASE "desde siempre".
// ============================================================================
export const presupuestoTramos = sqliteTable(
  "presupuesto_tramos",
  {
    id: text("id").primaryKey(),

    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categories.id),

    desdeAnio: integer("desde_anio"),
    desdeMes: integer("desde_mes"),

    importe: real("importe").notNull().default(0),
    moneda: text("moneda")
      .notNull()
      .references(() => currencies.code),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("idx_presupuesto_tramos_cat")
      .on(t.categoriaId)
      .where(sql`${t.deletedAt} IS NULL`),
    check(
      "presupuesto_tramos_mes_valido",
      sql`${t.desdeMes} IS NULL OR ${t.desdeMes} BETWEEN 1 AND 12`,
    ),
  ],
);

// ============================================================================
//  syncState — ESTADO DE SINCRONIZACION P2P (plomeria LOCAL, no se sincroniza)
// ============================================================================
//
//  Fase 2 (multi-dispositivo, sync peer-to-peer). Una fila por dispositivo-par
//  CONOCIDO, con los "cursores" que evitan reenviar lo ya intercambiado:
//
//    - lastPulledAt: mayor updatedAt que YA hemos integrado de ese par. Al
//      pedirle cambios, le pedimos solo > lastPulledAt.
//    - lastPushedAt: mayor updatedAt que YA le hemos enviado a ese par.
//
//  IMPORTANTE: esta tabla NO se sincroniza (no esta en SYNC_TABLE_ORDER de
//  domain/sync.ts). Es estado puramente local del dispositivo. La identidad de
//  ESTE dispositivo (deviceId propio) NO vive aqui sino en localStorage
//  (getDeviceId en lib/sync/device.ts), porque es per-instalacion y debe ser
//  estable e independiente de que usuario tenga la sesion abierta.
//
//  Sin soft-delete: "olvidar" un par es borrar su fila. Sin FK: no referencia
//  catalogos del usuario.
// ============================================================================
export const syncState = sqliteTable("sync_state", {
  // deviceId (UUID) del dispositivo par.
  peerDeviceId: text("peer_device_id").primaryKey(),

  // Nombre legible opcional para la UI ("Movil de Pedro"). Informativo.
  peerNombre: text("peer_nombre"),

  // Cursores de sincronizacion (ms epoch). NULL = nunca sincronizado aun.
  lastPulledAt: integer("last_pulled_at", { mode: "timestamp_ms" }),
  lastPushedAt: integer("last_pushed_at", { mode: "timestamp_ms" }),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ============================================================================
//  tombstones — LAPIDAS DE BORRADO (Fase 2, para que los borrados se propaguen)
// ============================================================================
//
//  Cuando el usuario VACIA la papelera, el registro se borra fisicamente de su
//  tabla (libera la fila pesada y la papelera sigue funcionando igual). Pero en
//  un mundo multi-dispositivo eso resucitaria el registro desde el otro
//  dispositivo en la siguiente sync. Para evitarlo, al borrar definitivamente
//  dejamos aqui una LAPIDA ligera: solo el id, la tabla de origen y cuando se
//  borro. La sync la trata como "este id esta muerto desde T": si el otro
//  dispositivo tiene la fila viva con un updatedAt anterior, la borra.
//
//  El `id` es el del registro borrado (UUID, unico entre tablas, sirve de PK).
//  `updatedAt` = momento del borrado (lo que usa el LWW). A diferencia del
//  resto, SI se sincroniza, pero por un canal aparte (no esta en
//  SYNC_TABLE_ORDER, que es para upserts de entidades).
//
//  GC futuro: una lapida puede purgarse cuando ya se ha confirmado en todos
//  los pares conocidos (no implementado todavia).
// ============================================================================
export const tombstones = sqliteTable(
  "tombstones",
  {
    id: text("id").primaryKey(),
    tabla: text("tabla").notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("idx_tombstones_updated").on(t.updatedAt)],
);

// ============================================================================
//  patrimonio_snapshots — HISTORICO DEL PATRIMONIO (una foto al dia)
// ============================================================================
//
//  Guarda el valor neto y su desglose un dia concreto, para poder dibujar la
//  evolucion REAL del patrimonio (hoy el valor de inversiones solo se conoce
//  "ahora"; sin estas fotos no hay forma de reconstruir el pasado).
//
//  El `id` es DETERMINISTA por dia ("snap-YYYY-MM-DD"): re-capturar el mismo
//  dia ACTUALIZA la fila (la ultima foto del dia gana) en vez de duplicar.
//  `fecha` es la fecha civil del dia a mediodia UTC (ver utils/dates). Los
//  valores estan en la moneda LOCAL (base estable), guardada en `moneda`.
//
//  De momento NO se sincroniza (datos derivados, locales por dispositivo). Si
//  en el futuro interesa el historico cross-device, el id determinista y los
//  campos updated_at/deleted_at ya dejan la puerta abierta.
// ============================================================================
export const patrimonioSnapshots = sqliteTable(
  "patrimonio_snapshots",
  {
    id: text("id").primaryKey(),
    fecha: integer("fecha", { mode: "timestamp_ms" }).notNull(),
    moneda: text("moneda").notNull(),
    valorCuentas: real("valor_cuentas").notNull(),
    valorInversiones: real("valor_inversiones").notNull(),
    deudaTotal: real("deuda_total").notNull(),
    patrimonioNeto: real("patrimonio_neto").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("idx_patrimonio_snap_fecha").on(t.fecha)],
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

export type InvestmentContribution =
  typeof investmentContributions.$inferSelect;
export type NewInvestmentContribution =
  typeof investmentContributions.$inferInsert;

export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;

export type ObjetivoAhorroTramo = typeof objetivoAhorroTramos.$inferSelect;
export type NewObjetivoAhorroTramo = typeof objetivoAhorroTramos.$inferInsert;

export type PresupuestoTramo = typeof presupuestoTramos.$inferSelect;
export type NewPresupuestoTramo = typeof presupuestoTramos.$inferInsert;

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;

export type Tombstone = typeof tombstones.$inferSelect;
export type NewTombstone = typeof tombstones.$inferInsert;

export type PatrimonioSnapshot = typeof patrimonioSnapshots.$inferSelect;
export type NewPatrimonioSnapshot = typeof patrimonioSnapshots.$inferInsert;
