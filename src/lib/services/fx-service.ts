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
 *  exoticas como ARS; esas se quedan con su valor manual).
 *
 *  La peticion va por el plugin HTTP de Tauri (evita CORS). Import dinamico
 *  para no romper el render en servidor / build.
 * ============================================================================
 */

/**
 * Devuelve { CODE: rate } donde rate = cuantas unidades de CODE equivale 1
 * unidad de `base`. Solo incluye las monedas que el proveedor cubre.
 */
export async function fetchFxRates(
  base: string,
  symbols: string[],
): Promise<Record<string, number>> {
  const targets = symbols.filter((s) => s && s !== base);
  if (targets.length === 0) return {};

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
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
