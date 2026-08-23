/**
 * ============================================================================
 *  src/lib/help/tours.ts — Contenido de los tours guiados por pantalla
 * ============================================================================
 *
 *  Registro central: ruta -> pasos del tour. Cada paso puede apuntar a un
 *  elemento (selector `[data-tour="..."]`) o ser un paso centrado (sin target).
 *  Anadir una pantalla = anadir su entrada aqui + marcar sus elementos con
 *  data-tour en el JSX.
 * ============================================================================
 */

import type { TourStep } from "@/contexts/TourProvider";

// Pasos comunes al final de cada tour (botones globales de la barra superior).
const OUTRO: TourStep[] = [
  {
    target: '[data-tour="privacy-toggle"]',
    title: "Modo privacidad",
    content:
      "Con este ojo ocultas todos los importes de la app (se ven como ••••), manteniendo nombres, fechas y porcentajes. Es local de este dispositivo.",
  },
  {
    target: '[data-tour="help-button"]',
    title: "Ayuda de cada pantalla",
    content:
      "Pulsa este botón en cualquier pantalla para volver a ver su guía paso a paso.",
  },
];

const TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      title: "Bienvenido a tu panel",
      content:
        "El Dashboard resume tu situación del mes: ingresos, gastos, ahorro y patrimonio. Te enseño lo principal en unos pasos.",
    },
    {
      target: '[data-tour="dashboard-period"]',
      title: "Mes que estás viendo",
      content:
        "Cambia aquí el mes y año. Todo el panel (KPIs, gráficas y listas) se recalcula para ese periodo.",
    },
    {
      target: '[data-tour="dashboard-kpis"]',
      title: "Tus cifras clave",
      content:
        "Ingresos, gastos, ahorro (con su tasa) y patrimonio neto. Incluyen los movimientos previstos del mes (recurrentes que aún no han ocurrido).",
    },
    ...OUTRO,
  ],
};

/**
 * Devuelve los pasos del tour para una ruta, o [] si no hay tour definido.
 * Normaliza la barra final (/dashboard/ == /dashboard).
 */
export function getTourForRoute(pathname: string | null | undefined): TourStep[] {
  if (!pathname) return [];
  const key = pathname.replace(/\/+$/, "") || "/";
  return TOURS[key] ?? [];
}

/** ¿Hay tour para esta ruta? (para mostrar/ocultar el boton "?"). */
export function hasTourForRoute(pathname: string | null | undefined): boolean {
  return getTourForRoute(pathname).length > 0;
}
