/**
 * tests/services/ft-fund-nav.test.ts — parser del VL de fondos (Financial Times).
 *
 * Yahoo no cubre los fondos espanoles (ISIN ES...), asi que el VL se lee de la
 * ficha HTML de markets.ft.com. Aqui probamos SOLO el parser puro (sin red).
 */

import { describe, it, expect } from "vitest";
import { parseFtFundNav } from "@/lib/services/quote-service";

// Fragmento real de la cabecera de la ficha (CaixaBank Pro 0/30 RV Estandar FI).
const HTML_OK =
  '<span class="mod-ui-data-list__label" title="Also known as NAV...">Price (EUR)</span>' +
  '<span class="mod-ui-data-list__value">144.70</span>' +
  '<span class="mod-ui-data-list__label">Today\'s Change</span>' +
  '<span class="mod-ui-data-list__value">0.566 / 0.39%</span>';

describe("parseFtFundNav", () => {
  it("extrae VL y divisa de la ficha de FT", () => {
    const q = parseFtFundNav(HTML_OK);
    expect(q.precio).toBe(144.7);
    expect(q.moneda).toBe("EUR");
  });

  it("respeta otras divisas (USD)", () => {
    const html =
      'Price (USD)</span><span class="mod-ui-data-list__value">12.34</span>';
    expect(parseFtFundNav(html)).toEqual({ precio: 12.34, moneda: "USD" });
  });

  it("quita el separador de miles (formato anglosajon)", () => {
    const html =
      'Price (GBP)</span><span class="mod-ui-data-list__value">1,234.56</span>';
    expect(parseFtFundNav(html).precio).toBe(1234.56);
  });

  it("tolera atributos extra en el span del valor", () => {
    const html =
      'Price (EUR)</span><span class="mod-ui-data-list__value" data-x="1"> 99.5 </span>';
    expect(parseFtFundNav(html).precio).toBe(99.5);
  });

  it("lanza si la pagina no trae precio (ISIN no cubierto)", () => {
    expect(() => parseFtFundNav("<html>nada util</html>")).toThrow();
  });

  it("lanza si el precio no es valido (<= 0)", () => {
    const html =
      'Price (EUR)</span><span class="mod-ui-data-list__value">0.00</span>';
    expect(() => parseFtFundNav(html)).toThrow();
  });
});
