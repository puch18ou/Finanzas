"use client";

/**
 * ============================================================================
 *  src/components/fx/FxAutoRefresh.tsx
 * ============================================================================
 *
 *  Actualiza los tipos de cambio automaticamente al arrancar, como mucho una
 *  vez al dia (guardado en localStorage). Es best-effort y silencioso: si no
 *  hay red o el proveedor falla, no molesta — se reintenta otro dia o con el
 *  boton "Actualizar tipos" de la pantalla de Monedas.
 *
 *  No pinta nada (devuelve null). Se monta una vez, dentro de DatabaseReady.
 * ============================================================================
 */

import { useEffect, useRef } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useCurrenciesManagement } from "@/hooks/useCurrenciesManagement";

const STORAGE_KEY = "fx:lastRefresh";

export function FxAutoRefresh() {
  const { settings } = useSettings();
  const { refreshRates } = useCurrenciesManagement();
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current) return;
    if (!settings) return;

    const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let last: string | null = null;
    try {
      last = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage no disponible: seguimos sin cachear la fecha.
    }
    if (last === hoy) {
      lanzado.current = true;
      return;
    }

    lanzado.current = true;
    refreshRates({ viewCurrency: settings.monedaVista })
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEY, hoy);
        } catch {
          // ignorar
        }
      })
      .catch(() => {
        // Silencioso: se reintenta otro dia o con el boton manual.
      });
  }, [settings, refreshRates]);

  return null;
}
