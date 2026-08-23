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
    {
      target: '[data-tour="dashboard-ahorro"]',
      title: "Ahorro acumulado vs objetivo",
      content:
        "Si tienes fijado un objetivo de ahorro, aquí ves cuánto llevas acumulado desde esa fecha y si vas cumpliendo el objetivo (por importe y por tasa).",
    },
    {
      target: '[data-tour="dashboard-avisos"]',
      title: "Avisos",
      content:
        "Te avisa cuando una categoría se acerca a su presupuesto (ámbar) o lo supera (rojo). Solo aparece si hay algo que avisar.",
    },
    {
      target: '[data-tour="dashboard-cashflow"]',
      title: "Previsión de liquidez",
      content:
        "Proyecta tu saldo de las próximas semanas con los recurrentes previstos: saldo de hoy, previsto a fin de mes y aviso si te pondrías en números rojos.",
    },
    {
      target: '[data-tour="dashboard-categoria"]',
      title: "Gasto por categoría",
      content:
        "El reparto del gasto del mes por categoría. Pasa el ratón por cada porción para ver su importe.",
    },
    {
      target: '[data-tour="dashboard-categoria-tipo"]',
      title: "Cambiar el tipo de gráfica",
      content:
        "Con este botón eliges cómo ver el gasto por categoría: Tarta, Donut o Barras horizontales. Púlsalo y quédate con el que más te guste.",
      placement: "bottom",
    },
    {
      target: '[data-tour="dashboard-presupuesto"]',
      title: "Presupuesto del mes",
      content:
        "Progreso de cada categoría con presupuesto: cuánto llevas gastado respecto al límite del mes.",
    },
    {
      target: '[data-tour="dashboard-recientes"]',
      title: "Movimientos recientes",
      content:
        "Los últimos movimientos registrados. Para verlos todos, filtrar u ordenar, ve a la pantalla Movimientos.",
    },
    ...OUTRO,
  ],

  "/evolucion": [
    {
      preClick: '[data-tour="evo-tab-general"]',
      target: '[data-tour="evo-tabs"]',
      title: "Tres vistas",
      content:
        "Evolución tiene tres pestañas: General, Comparar años y Por categoría. Te las enseño una a una.",
    },
    // --- General ---
    {
      preClick: '[data-tour="evo-tab-general"]',
      target: '[data-tour="evo-general-anio"]',
      title: "General · año a mostrar",
      content:
        "Elige el año (o «Desde objetivo de ahorro»). Todo el resumen mensual se recalcula para ese periodo.",
      placement: "bottom",
    },
    {
      preClick: '[data-tour="evo-tab-general"]',
      target: '[data-tour="evo-general-tipo"]',
      title: "General · tipo de gráfica",
      content:
        "Con este botón cambias cómo se ven los datos: líneas, barras agrupadas o apiladas, áreas o combo.",
      placement: "bottom",
    },
    // --- Comparar años ---
    {
      preClick: '[data-tour="evo-tab-comparar"]',
      target: '[data-tour="evo-comparar-anios"]',
      title: "Comparar años · años",
      content:
        "Activa o desactiva los años que quieras comparar. Se dibuja una línea por año sobre el eje enero–diciembre.",
    },
    {
      preClick: '[data-tour="evo-tab-comparar"]',
      target: '[data-tour="evo-comparar-metrica"]',
      title: "Comparar años · qué comparar",
      content: "Elige la métrica de la comparación: gastos, ingresos o ahorro.",
      placement: "bottom",
    },
    // --- Por categoría ---
    {
      preClick: '[data-tour="evo-tab-categorias"]',
      target: '[data-tour="evo-categoria-anio"]',
      title: "Por categoría · año",
      content: "Elige el año que quieres desglosar por categorías.",
      placement: "bottom",
    },
    {
      preClick: '[data-tour="evo-tab-categorias"]',
      target: '[data-tour="evo-categoria-select"]',
      title: "Por categoría · categorías",
      content:
        "Elige una o varias categorías (multiselección) para ver su gasto neto mes a mes, una línea por categoría.",
    },
    // --- Cierre: volver a General en silencio (sin burbuja) ---
    {
      preClick: '[data-tour="evo-tab-general"]',
      auto: true,
      title: "",
      content: "",
    },
  ],

  "/proyeccion": [
    {
      target: '[data-tour="proy-desde"]',
      title: "Contar el ahorro desde",
      content:
        "Elige desde qué mes se calcula tu ahorro. El mínimo es tu primer mes con datos; no se cuenta nada anterior a esa fecha.",
      placement: "bottom",
    },
    {
      target: '[data-tour="proy-objetivo"]',
      title: "Proyectar hasta",
      content:
        "La fecha objetivo: la proyección del patrimonio llega hasta ese mes.",
      placement: "bottom",
    },
    {
      target: '[data-tour="proy-ahorro"]',
      title: "Ahorro mensual medio",
      content:
        "Tu ahorro medio en el periodo elegido. Es el ritmo con el que se estima el crecimiento del patrimonio.",
      placement: "bottom",
    },
    {
      target: '[data-tour="proy-grafica"]',
      title: "La proyección",
      content:
        "Estimación lineal de tu patrimonio hasta la fecha objetivo (sin inflación ni rendimiento de inversiones). Las líneas punteadas marcan tus metas.",
    },
    {
      target: '[data-tour="proy-metas"]',
      title: "Metas",
      content:
        "Para cada meta, la fecha estimada en la que la alcanzarías con tu ahorro medio, y si vas a tiempo o con retraso.",
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
