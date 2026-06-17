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
    // interval=1m + includePrePost: la serie incluye PRE-mercado y AFTER-HOURS,
    // asi cogemos el ultimo precio negociado (mas actual), no solo el cierre de
    // la sesion regular (que es lo que devuelve regularMarketPrice).
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=true`;

    const res = await tauriFetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Respuesta HTTP ${res.status} para "${sym}"`);
    }

    const json = (await res.json()) as YahooChartResponse;
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    let moneda = meta?.currency;

    // Precio MAS RECIENTE: ultimo cierre no nulo de la serie (incluye
    // after-hours / pre-market). Si no hay serie, respaldo al precio de la
    // sesion regular.
    let precio: number | undefined;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes)) {
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = closes[i];
        if (typeof c === "number" && Number.isFinite(c) && c > 0) {
          precio = c;
          break;
        }
      }
    }
    if (precio == null) precio = meta?.regularMarketPrice;

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

export type SymbolMatch = {
  symbol: string;
  nombre: string;
  tipo: string; // quoteType de Yahoo: EQUITY, ETF, MUTUALFUND, CRYPTOCURRENCY...
  exchange?: string;
};

/**
 * Resuelve un ISIN (o nombre/ticker) a un simbolo cotizable usando la busqueda
 * de Yahoo. Devuelve la primera coincidencia con simbolo, o null si no hay.
 * Sirve para rellenar el ticker automaticamente al dar de alta una inversion.
 * OJO: Yahoo cubre acciones/ETF y algunos fondos, pero NO los fondos de
 * inversion clasicos (CaixaBank y similares): esos devolveran null.
 */
export async function resolveSymbolByIsin(
  isin: string,
): Promise<SymbolMatch | null> {
  const q = isin.trim();
  if (!q) return null;

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const url =
    `https://query2.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;

  const res = await tauriFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Respuesta HTTP ${res.status} buscando "${q}"`);
  }

  const json = (await res.json()) as YahooSearchResponse;
  const first = (json?.quotes ?? []).find((x) => x?.symbol);
  if (!first?.symbol) return null;

  return {
    symbol: first.symbol,
    nombre: first.longname ?? first.shortname ?? first.symbol,
    tipo: first.quoteType ?? "",
    exchange: first.exchange,
  };
}

// ============================================================================
//  Fondos por ISIN — Financial Times (Yahoo no cubre los fondos espanoles)
// ============================================================================

/**
 * Extrae el VL (NAV) y la divisa del HTML de una ficha de fondo de
 * markets.ft.com. Funcion PURA (testeable sin red). La cabecera trae:
 *
 *   <span ...>Price (EUR)</span><span class="mod-ui-data-list__value">144.70</span>
 *
 * FT usa formato anglosajon: coma de miles, punto decimal (p.ej. 1,234.56).
 */
export function parseFtFundNav(html: string): Quote {
  const m = html.match(
    /Price \(([A-Z]{3})\)<\/span>\s*<span class="mod-ui-data-list__value"[^>]*>\s*([\d.,]+)/,
  );
  if (!m || !m[1] || !m[2]) {
    throw new Error("FT no devolvio VL (ISIN no cubierto o pagina cambiada).");
  }
  const moneda = m[1].toUpperCase();
  // Quitamos el separador de miles (coma); el punto es el decimal.
  const precio = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error("VL no valido en FT.");
  }
  return { precio, moneda };
}

/**
 * VL de un fondo a partir de su ISIN, leido de Financial Times.
 *
 * Yahoo NO cubre los fondos espanoles (ISIN `ES...`): su busqueda devuelve
 * vacio, o un listado de Frankfurt con un VL DESFASADO del oficial (por eso los
 * CaixaBank "no cuadraban" con el banco mientras Algebris —luxemburgues, si en
 * Yahoo— si). FT publica el VL oficial diario en la divisa del fondo.
 *
 * Es scraping de HTML (no hay API oficial), asi que puede romperse si FT cambia
 * la maqueta; en ese caso el usuario siempre puede meter el valor a mano.
 */
export async function fetchFundNavByIsin(isin: string): Promise<Quote> {
  const id = isin.trim().toUpperCase();
  if (!id) throw new Error("ISIN vacio");

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const url =
    `https://markets.ft.com/data/funds/tearsheet/summary?s=${encodeURIComponent(id)}`;

  const res = await tauriFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Respuesta HTTP ${res.status} para "${id}" en FT`);
  }
  return parseFtFundNav(await res.text());
}

// --- Tipos minimos de la respuesta de Yahoo (solo lo que usamos) ---
type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
  }>;
};
