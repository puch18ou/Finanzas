/**
 * ============================================================================
 *  src/lib/domain/currency.ts — Conversion entre monedas
 * ============================================================================
 *
 *  Funciones puras: reciben datos, devuelven datos. Sin tocar BD, sin
 *  efectos secundarios. La capa de aplicacion (hooks, paginas) llama a
 *  estas funciones pasandoles los tipos de cambio leidos previamente.
 *
 *  MODELO MENTAL DE TIPOS DE CAMBIO
 *  --------------------------------
 *  Cada moneda guarda `tipoCambioVista`: cuantas unidades de la moneda de
 *  visualizacion equivale 1 unidad de esa moneda. La moneda de visualizacion
 *  en si misma siempre vale 1.
 *
 *  Ejemplo (moneda vista = EUR):
 *    EUR: tipoCambioVista = 1.0    (1 EUR = 1 EUR)
 *    SGD: tipoCambioVista = 0.69   (1 SGD = 0.69 EUR)
 *    USD: tipoCambioVista = 0.92   (1 USD = 0.92 EUR)
 *
 *  Convertir de SGD a USD:
 *    1. Pasamos por la moneda vista: 100 SGD * 0.69 = 69 EUR
 *    2. Dividimos por el rate del destino: 69 EUR / 0.92 = 75 USD
 *
 *  Esta indireccion via moneda vista nos permite tener N*N conversiones
 *  con solo N rates almacenados. Sin moneda pivote, necesitariamos N*(N-1)/2
 *  pares.
 *
 *  IMPORTANTE: si en el futuro el usuario cambia la moneda de visualizacion,
 *  TODOS los tipos de cambio almacenados deben recalcularse (eso lo hace
 *  el CurrencyRepository, no esta capa).
 * ============================================================================
 */

import type { Currency } from "@/lib/db/schema";

/**
 * Mapa de tipos de cambio: codigo de moneda → tipoCambioVista.
 * Es el formato compacto que las funciones de conversion esperan.
 */
export type RatesMap = Record<string, number>;

/**
 * Construye un RatesMap a partir de la lista de monedas de la BD.
 * Lo usaremos al inicio de cualquier calculo masivo: una vez tienes el
 * mapa, conviertes lo que quieras sin volver a tocar la BD.
 */
export function buildRatesMap(currencies: Currency[]): RatesMap {
  const map: RatesMap = {};
  for (const c of currencies) {
    map[c.code] = c.tipoCambioVista;
  }
  return map;
}

/**
 * Convierte un importe de una moneda a otra usando el RatesMap.
 *
 * @throws si alguna de las monedas no esta en el mapa
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: RatesMap,
): number {
  // Caso trivial: misma moneda.
  if (from === to) return amount;

  const rateFrom = rates[from];
  const rateTo = rates[to];

  if (rateFrom === undefined) {
    throw new Error(`convert: moneda '${from}' no encontrada en el mapa de tipos de cambio`);
  }
  if (rateTo === undefined) {
    throw new Error(`convert: moneda '${to}' no encontrada en el mapa de tipos de cambio`);
  }

  // amount [from] → [moneda vista] → [to]
  const inView = amount * rateFrom;
  return inView / rateTo;
}

/**
 * Formatea un importe con su simbolo de moneda. Sigue la convencion
 * regional del navegador del usuario.
 *
 * @param amount   importe en la moneda indicada
 * @param currency codigo ISO (EUR, USD, SGD...)
 * @param options  opciones de formato (decimales, etc)
 */
export function formatAmount(
  amount: number,
  currency: string,
  options: { decimals?: number; locale?: string } = {},
): string {
  const { decimals = 2, locale = "es-ES" } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Si el codigo de moneda no es valido segun ISO 4217, caemos a un
    // formato manual. Ocurre en monedas custom o cripto.
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

/**
 * Cuando el usuario cambia la moneda de visualizacion, hay que recalcular
 * todos los tipos de cambio para que sigan refiriendose a la nueva moneda
 * vista. Esta funcion devuelve los nuevos rates a partir de los antiguos.
 *
 * Si los rates actuales son contra X (X.tipoCambioVista = 1) y queremos
 * pasar a Y, dividimos cada rate por el rate de Y.
 *
 * Ejemplo: rates actuales contra EUR (EUR=1, SGD=0.69, USD=0.92).
 * Si queremos pasar a moneda vista USD:
 *    nuevoEUR = 1 / 0.92    = 1.087   (1 EUR = 1.087 USD)
 *    nuevoSGD = 0.69 / 0.92 = 0.75    (1 SGD = 0.75 USD)
 *    nuevoUSD = 0.92 / 0.92 = 1       (1 USD = 1 USD)
 *
 * @throws si la nueva moneda vista no esta en el mapa
 */
export function recomputeRatesForNewView(
  oldRates: RatesMap,
  newViewCurrency: string,
): RatesMap {
  const divisor = oldRates[newViewCurrency];
  if (divisor === undefined || divisor === 0) {
    throw new Error(
      `recomputeRatesForNewView: moneda '${newViewCurrency}' no esta en el mapa o tiene rate 0`,
    );
  }

  const newRates: RatesMap = {};
  for (const [code, rate] of Object.entries(oldRates)) {
    newRates[code] = rate / divisor;
  }
  return newRates;
}
