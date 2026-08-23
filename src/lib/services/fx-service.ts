/**
 * ============================================================================
 *  src/lib/services/fx-service.ts — Tipos de cambio (FX)
 * ============================================================================
 *
 *  Obtiene tipos de cambio para actualizar currencies.tipoCambioVista sin
 *  teclearlos a mano. Proveedor: Frankfurter (api.frankfurter.dev), gratis y
 *  sin clave, basado en las referencias diarias del BCE.
 *
 *  Una sola peticion devuelve "cuantas unidades de cada `symbol` equivale 1
 *  unidad de `base`". Cobertura: las ~30 monedas del BCE (no incluye algunas
 *  exoticas como ARS).
 *
 *  IMPORTANTE (fix ARS): si se incluye una moneda que Frankfurter NO soporta
 *  (p.ej. ARS) en `symbols`, la peticion /latest devuelve error y fallaria la
 *  actualizacion ENTERA. Por eso primero consultamos la lista de monedas
 *  soportadas (/currencies) y pedimos SOLO esas; las no cubiertas se quedan con
 *  su tipo manual (el llamador las trata como "no cubiertas").
 *
 *  La peticion va por el plugin HTTP de Tauri (evita CORS). Import dinamico
 *  para no romper el render en servidor / build.
 * ============================================================================
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TauriFetch = (input: string, init?: any) => Promise<Response>;

// Cache de monedas soportadas por el proveedor (por sesion de la app).
let supportedCache: Set<string> | null = null;

/**
 * Conjunto de codigos que Frankfurter soporta. Se cachea tras la primera
 * llamada. Si falla la consulta, se propaga el error (el llamador ya lo maneja).
 */
async function getSupportedCurrencies(
  tauriFetch: TauriFetch,
): Promise<Set<string>> {
  if (supportedCache) return supportedCache;
  const res = await tauriFetch("https://api.frankfurter.dev/v1/currencies", {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`Respuesta HTTP ${res.status} al pedir monedas soportadas`);
  }
  const json = (await res.json()) as Record<string, string>;
  supportedCache = new Set(Object.keys(json ?? {}));
  return supportedCache;
}

/**
 * Devuelve { CODE: rate } donde rate = cuantas unidades de CODE equivale 1
 * unidad de `base`. Solo incluye las monedas que el proveedor cubre; las no
 * soportadas (o si `base` no esta soportada) se omiten sin romper el resto.
 */
export async function fetchFxRates(
  base: string,
  symbols: string[],
): Promise<Record<string, number>> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  const supported = await getSupportedCurrencies(tauriFetch);
  // Si la moneda base no la cubre el proveedor, no podemos pedir nada: todas se
  // quedan con su tipo manual.
  if (!supported.has(base)) return {};

  // Solo pedimos las monedas que el proveedor soporta (excluye ARS y similares).
  const targets = symbols.filter(
    (s) => s && s !== base && supported.has(s),
  );
  if (targets.length === 0) return {};

  const url =
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}` +
    `&symbols=${encodeURIComponent(targets.join(","))}`;

  const res = await tauriFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Respuesta HTTP ${res.status} al pedir tipos de cambio`);
  }

  const json = (await res.json()) as FrankfurterResponse;
  const rates = json?.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Respuesta de tipos de cambio sin datos");
  }
  return rates;
}

type FrankfurterResponse = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};
