"use client";

/**
 * ============================================================================
 *  src/components/fx/MarketAutoRefresh.tsx
 * ============================================================================
 *
 *  Al ABRIR la app (una vez por sesion) refresca, de forma silenciosa y
 *  best-effort:
 *    1) los tipos de cambio (BCE / Frankfurter), y
 *    2) las cotizaciones de todas las posiciones cotizables (con ticker,
 *       salvo cuentas remuneradas), usando los tipos recien refrescados.
 *
 *  Decision de producto (Pedro, jun 2026): refresco SOLO al abrir, sin
 *  temporizador. El boton manual de /inversiones y /monedas sigue disponible.
 *
 *  Si no hay red o algun proveedor falla, no molesta: se reintenta al volver a
 *  abrir o con los botones manuales. No pinta nada (devuelve null). Se monta
 *  una vez dentro de DatabaseReady.
 * ============================================================================
 */

import { useEffect, useRef } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCurrenciesManagement } from "@/hooks/useCurrenciesManagement";
import { useInvestments } from "@/hooks/useInvestments";
import { buildRatesMap } from "@/lib/domain/currency";
import { recordHealthError, clearHealthError } from "@/lib/utils/health-log";
import type { Investment } from "@/lib/db/schema";

// Mismo criterio que /inversiones: cotiza cualquier activo con ticker, salvo
// la cuenta remunerada (se valora por TAE, no por mercado).
const esCotizable = (inv: Investment) =>
  !!inv.ticker &&
  inv.ticker.trim() !== "" &&
  inv.tipo !== "Cuenta remunerada";

export function MarketAutoRefresh() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { refreshRates } = useCurrenciesManagement();
  const { investments, isLoading, refreshQuote } = useInvestments();
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current) return;
    if (!settings) return;
    // Esperamos a que las inversiones esten cargadas para poder cotizarlas;
    // asi tambien evitamos lanzar con la lista vacia por carga en curso.
    if (isLoading) return;

    lanzado.current = true;

    (async () => {
      // 1) Tipos de cambio. Si va bien, usamos el mapa recien actualizado para
      //    convertir las cotizaciones (p.ej. oro USD->EUR) con el tipo de hoy.
      let useRates = buildRatesMap(currencies);
      try {
        const res = await refreshRates({ viewCurrency: settings.monedaVista });
        if (res?.ratesMap) useRates = res.ratesMap;
        clearHealthError("fx");
      } catch (e) {
        // Silencioso para el usuario, pero lo registramos para la Salud.
        recordHealthError("fx", e);
      }

      // 2) Cotizaciones de las posiciones cotizables, una a una y tolerante a
      //    fallos por posicion (una que falle no corta el resto).
      const cotizables = investments.filter(esCotizable);
      const fallidas: string[] = [];
      for (const inv of cotizables) {
        try {
          await refreshQuote({ inv, rates: useRates });
        } catch {
          fallidas.push(inv.ticker ?? inv.nombre);
        }
      }
      if (fallidas.length > 0) {
        recordHealthError(
          "quotes",
          `No se pudieron cotizar: ${fallidas.join(", ")}`,
        );
      } else if (cotizables.length > 0) {
        clearHealthError("quotes");
      }
    })();
  }, [settings, currencies, investments, isLoading, refreshRates, refreshQuote]);

  return null;
}
