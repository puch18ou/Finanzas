/**
 * ============================================================================
 *  src/lib/services/quote-service.ts — Cotizaciones de mercado
 * ============================================================================
 *
 *  Obtiene el ultimo precio de un activo a partir de su simbolo (ticker). Se
 *  usa para actualizar investments.precioActual sin teclear a mano.
 *
 *  PROVEEDOR
 *  ---------
 *  Capa intercambiable (`QuoteProvider`). Por defecto usamos Yahoo Finance
 *  (endpoint v8/chart): gratis y sin clave, cobertura global de acciones/ETF,
 *  devuelve precio y moneda. Es NO OFICIAL y puede cambiar; por eso el usuario
 *  siempre puede actualizar el precio a mano, y la capa permite cambiar de
 *  proveedor (Stooq, una API con clave...) sin tocar el resto.
 *
 *  La peticion se hace con el plugin HTTP de Tauri (evita CORS). El import es
 *  dinamico para no romper el render en servidor / build.
 * ============================================================================
 */

export type Quote = {
  /** Ultimo precio, en la moneda `moneda`. */
  precio: number;
  /** Codigo de moneda del precio (ISO 4217), p. ej. "USD", "EUR". */
  moneda: string;
};

export interface QuoteProvider {
  nombre: string;
  fetchQuote(symbol: string): Promise<Quote>;
}

const yahooProvider: QuoteProvider = {
  nombre: "Yahoo Finance",
  async fetchQuote(symbol: string): Promise<Quote> {
    const sym = symbol.trim();
    if (!sym) throw new Error("Ticker vacio");

    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(sym)}?interval=1d&range=1d`;

    const res = await tauriFetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Respuesta HTTP ${res.status} para "${sym}"`);
    }

    const json = (await res.json()) as YahooChartResponse;
    const meta = json?.chart?.result?.[0]?.meta;
    let precio = meta?.regularMarketPrice;
    let moneda = meta?.currency;

    if (typeof precio !== "number" || !Number.isFinite(precio) || precio <= 0) {
      throw new Error(`No se encontro precio para "${sym}"`);
    }
    if (typeof moneda !== "string" || !moneda) {
      throw new Error(`No se encontro moneda para "${sym}"`);
    }

    // Yahoo devuelve algunos valores de Londres en PENIQUES ("GBp"/"GBX"):
    // 100 peniques = 1 GBP. Normalizamos a GBP para no inflar x100.
    if (moneda === "GBp" || moneda === "GBX") {
      precio = precio / 100;
      moneda = "GBP";
    }

    return { precio, moneda: moneda.toUpperCase() };
  },
};

/** Proveedor activo. Cambiar aqui para usar otro (Stooq, API con clave...). */
export const quoteProvider: QuoteProvider = yahooProvider;

export function fetchQuote(symbol: string): Promise<Quote> {
  return quoteProvider.fetchQuote(symbol);
}

// --- Tipos minimos de la respuesta de Yahoo (solo lo que usamos) ---
type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
      };
    }>;
    error?: unknown;
  };
};
