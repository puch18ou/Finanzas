/**
 * ============================================================================
 *  src/lib/db/seed.ts — Datos iniciales (monedas + categorias + settings)
 * ============================================================================
 *
 *  Se ejecuta al arrancar la app, despues de runMigrations().
 *  Idempotente: solo inserta filas si las tablas estan vacias.
 *
 *  Si el usuario edita una moneda o categoria y reinicia la app, sus cambios
 *  se respetan (no se sobreescriben). Solo se rellenan tablas vacias.
 *
 *  ELECCION DE VALORES POR DEFECTO
 *  -------------------------------
 *  Las monedas y tipos de cambio iniciales vienen del Excel original.
 *  Son aproximados (los tipos de cambio reales cambian a diario); el
 *  usuario podra editarlos en la pantalla de Monedas.
 *
 *  Las categorias replican exactamente las del Excel con sus presupuestos
 *  mensuales en moneda local (EUR), para que el usuario tenga un punto de
 *  partida razonable.
 *
 *  La fila singleton de settings se crea con valores sensatos: moneda
 *  local EUR, moneda vista EUR, anio y mes actuales reales del sistema.
 * ============================================================================
 */

import { getDb } from "./client";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

/**
 * Catalogo inicial de monedas. Los tipos de cambio expresan cuantos
 * EUR equivale 1 unidad de cada moneda (la moneda vista por defecto es EUR).
 */
const MONEDAS_SEED = [
  { code: "EUR", nombre: "Euro", simbolo: "€", tipoCambioVista: 1.0, orden: 0 },
  { code: "SGD", nombre: "Dolar de Singapur", simbolo: "S$", tipoCambioVista: 0.69, orden: 1 },
  { code: "USD", nombre: "Dolar estadounidense", simbolo: "$", tipoCambioVista: 0.92, orden: 2 },
  { code: "GBP", nombre: "Libra esterlina", simbolo: "£", tipoCambioVista: 1.17, orden: 3 },
  { code: "JPY", nombre: "Yen japones", simbolo: "¥", tipoCambioVista: 0.0061, orden: 4 },
  { code: "CHF", nombre: "Franco suizo", simbolo: "CHF", tipoCambioVista: 1.05, orden: 5 },
  { code: "MXN", nombre: "Peso mexicano", simbolo: "$", tipoCambioVista: 0.054, orden: 6 },
  { code: "CAD", nombre: "Dolar canadiense", simbolo: "$", tipoCambioVista: 0.68, orden: 7 },
  { code: "AUD", nombre: "Dolar australiano", simbolo: "$", tipoCambioVista: 0.6, orden: 8 },
  { code: "BRL", nombre: "Real brasileno", simbolo: "R$", tipoCambioVista: 0.18, orden: 9 },
  { code: "ARS", nombre: "Peso argentino", simbolo: "$", tipoCambioVista: 0.0011, orden: 10 },
  { code: "CNY", nombre: "Yuan chino", simbolo: "¥", tipoCambioVista: 0.13, orden: 11 },
  { code: "HKD", nombre: "Dolar de Hong Kong", simbolo: "HK$", tipoCambioVista: 0.12, orden: 12 },
];

/**
 * Catalogo inicial de categorias de gasto. Presupuestos en EUR (moneda local).
 */
const CATEGORIAS_SEED = [
  { nombre: "Vivienda", tipo: "Esencial", presupuesto: 0, notas: "Alquiler, comunidad" },
  { nombre: "Suministros", tipo: "Esencial", presupuesto: 0, notas: "Luz, agua, gas, internet" },
  { nombre: "Supermercado", tipo: "Esencial", presupuesto: 0, notas: "Compra semanal" },
  { nombre: "Transporte", tipo: "Esencial", presupuesto: 0, notas: "Transporte, taxis, combustible" },
  { nombre: "Salud", tipo: "Esencial", presupuesto: 0, notas: "Farmacia, medico, seguro" },
  { nombre: "Restaurantes", tipo: "Ocio", presupuesto: 0, notas: null },
  { nombre: "Ocio y entretenimiento", tipo: "Ocio", presupuesto: 0, notas: "Cine, conciertos, suscripciones" },
  { nombre: "Ropa y calzado", tipo: "Personal", presupuesto: 0, notas: null },
  { nombre: "Viajes", tipo: "Ocio", presupuesto: 0, notas: null },
  { nombre: "Educacion", tipo: "Inversion personal", presupuesto: 0, notas: "Cursos, libros" },
  { nombre: "Regalos", tipo: "Personal", presupuesto: 0, notas: null },
  { nombre: "Otros", tipo: "Variable", presupuesto: 0, notas: "Gastos sin clasificar" },
];

/**
 * Inserta monedas si la tabla esta vacia. Devuelve cuantas se insertaron.
 */
async function seedCurrencies(): Promise<number> {
  const db = await getDb();
  const now = Date.now();

  // Contamos filas existentes con una query agregada.
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.currencies);

  if ((existing[0]?.count ?? 0) > 0) {
    return 0;
  }

  const rows: schema.NewCurrency[] = MONEDAS_SEED.map((m) => ({
    code: m.code,
    nombre: m.nombre,
    simbolo: m.simbolo,
    tipoCambioVista: m.tipoCambioVista,
    orden: m.orden,
    activa: true,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }));

  await db.insert(schema.currencies).values(rows);
  return rows.length;
}

/**
 * Inserta categorias si la tabla esta vacia. Devuelve cuantas se insertaron.
 */
async function seedCategories(): Promise<number> {
  const db = await getDb();
  const now = Date.now();

  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.categories);

  if ((existing[0]?.count ?? 0) > 0) {
    return 0;
  }

  const rows: schema.NewCategory[] = CATEGORIAS_SEED.map((c, idx) => ({
    id: crypto.randomUUID(),
    nombre: c.nombre,
    tipo: c.tipo,
    presupuestoMensual: c.presupuesto,
    presupuestoMoneda: "EUR",
    notas: c.notas,
    orden: idx,
    color: null,
    icono: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: null,
  }));

  await db.insert(schema.categories).values(rows);
  return rows.length;
}

/**
 * Inserta la fila singleton de settings si no existe. Si el usuario ya tiene
 * configuracion, no la pisa.
 */
async function seedSettings(): Promise<boolean> {
  const db = await getDb();
  const now = Date.now();

  const existing = await db.select().from(schema.settings).limit(1);
  if (existing.length > 0) {
    return false;
  }

  const today = new Date();

  await db.insert(schema.settings).values({
    id: "singleton",
    monedaLocal: "EUR",
    monedaVista: "EUR",
    anioActual: today.getFullYear(),
    mesActual: today.getMonth() + 1,
    objetivoAhorroPct: 0.2,
    tieneHipoteca: false,
    incluirPrevistos: true,
    monedaHipoteca: "EUR",
    categoriaHipotecaId: null,
    patrimonioInicial: 0,
    patrimonioInicialMoneda: "EUR",
    tema: "system",
    idioma: "es",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });

  return true;
}

/**
 * Backfill del objetivo de ahorro a la tabla de tramos. Idempotente: solo
 * actua si la tabla de tramos esta vacia. Convierte el valor unico actual de
 * settings (pct/importe/desde) en un primer tramo:
 *
 *   - desde = objetivo_ahorro_desde (mes/anio en UTC) o NULL = "desde siempre".
 *   - pct/importe = los de settings; moneda = moneda local (el importe esta
 *     en moneda local).
 *
 * Si no hay objetivo (pct e importe a 0) no crea nada. Debe ejecutarse DESPUES
 * de seedSettings para que el singleton exista.
 */
async function seedObjetivoTramos(): Promise<number> {
  const db = await getDb();
  const now = Date.now();

  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.objetivoAhorroTramos);
  if ((existing[0]?.count ?? 0) > 0) {
    return 0;
  }

  const settingsRow = await db.select().from(schema.settings).limit(1);
  const s = settingsRow[0];
  if (!s) return 0;

  const pct = s.objetivoAhorroPct ?? 0;
  const importe = s.objetivoAhorroImporte ?? 0;
  if (pct <= 0 && importe <= 0) {
    return 0;
  }

  const desde =
    s.objetivoAhorroDesde instanceof Date
      ? s.objetivoAhorroDesde
      : s.objetivoAhorroDesde != null
        ? new Date(s.objetivoAhorroDesde)
        : null;

  await db.insert(schema.objetivoAhorroTramos).values({
    id: crypto.randomUUID(),
    desdeAnio: desde ? desde.getUTCFullYear() : null,
    desdeMes: desde ? desde.getUTCMonth() + 1 : null,
    pct,
    importe,
    moneda: s.monedaLocal,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: null,
  });

  return 1;
}

/**
 * Punto de entrada: ejecuta todos los seeds en orden.
 * Devuelve un resumen util para la pantalla de diagnostico.
 *
 * Nota: los tramos de PRESUPUESTO no se siembran. El presupuesto base vive en
 * categories.presupuestoMensual ("desde siempre"); presupuesto_tramos solo
 * guarda los cambios con fecha (ver domain/tramos.resolvePresupuesto).
 */
export async function runSeed(): Promise<{
  currencies: number;
  categories: number;
  settingsCreated: boolean;
  objetivoTramos: number;
}> {
  const currencies = await seedCurrencies();
  const categories = await seedCategories();
  const settingsCreated = await seedSettings();
  const objetivoTramos = await seedObjetivoTramos();

  return { currencies, categories, settingsCreated, objetivoTramos };
}
