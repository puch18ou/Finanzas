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
  ],

  "/presupuestos": [
    {
      target: '[data-tour="presu-periodo"]',
      title: "Mes que ves",
      content:
        "Elige el mes y año. El seguimiento de cada presupuesto se recalcula para ese periodo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="presu-consumo"]',
      title: "Consumo por categoría",
      content:
        "Cada categoría con presupuesto: lo gastado este mes y el acumulado del año, con su barra. Se incluyen los gastos previstos del mes (recurrentes aún no cargados).",
    },
    {
      target: '[data-tour="presu-flecha"]',
      title: "Ver el detalle",
      content:
        "Cuando una categoría tiene gastos, pulsa la flecha para desplegar en qué se ha ido el dinero. Los previstos aparecen marcados con su fecha.",
    },
  ],

  "/movimientos": [
    {
      target: '[data-tour="mov-modo"]',
      title: "Mes o rango",
      content:
        "Elige ver un solo mes o un rango de fechas. En modo Rango aparecen «Desde/Hasta» y unos atajos (últimos 3/6/12 meses, este año, año pasado).",
      placement: "bottom",
    },
    {
      target: '[data-tour="mov-nuevo"]',
      title: "Nuevo movimiento",
      content:
        "Crea un gasto, ingreso, transferencia o ajuste. También puedes usar el botón flotante «+».",
      placement: "bottom",
    },
    {
      target: '[data-tour="mov-proximos"]',
      title: "Próximos en el periodo",
      content:
        "Movimientos recurrentes que aún no han ocurrido este mes (previstos). Se materializan solos al llegar su día.",
    },
    {
      target: '[data-tour="mov-tabs"]',
      title: "Filtrar por tipo",
      content:
        "Todos, gastos, ingresos, transferencias o ajustes. El número es cuántos hay de cada uno.",
    },
    {
      target: '[data-tour="mov-buscar"]',
      title: "Buscar",
      content: "Filtra por concepto, categoría o etiqueta.",
    },
    {
      target: '[data-tour="mov-total"]',
      title: "Total en gasto neto",
      content:
        "El total de lo que estás viendo: los gastos cuentan a coste real (con devoluciones restadas); ingresos, transferencias y ajustes no suman.",
    },
    {
      target: '[data-tour="mov-ordenar"]',
      title: "Ordenar",
      content:
        "Pulsa las cabeceras (fecha, concepto, categoría o importe) para ordenar la lista.",
    },
    {
      target: '[data-tour="mov-devolucion"]',
      title: "Devoluciones de un gasto",
      content:
        "En cada gasto, este botón registra devoluciones (reembolsos). Se restan del gasto y verás su «coste real» sin que cuenten como ingreso.",
    },
  ],

  "/recurrentes": [
    {
      target: '[data-tour="rec-nuevo"]',
      title: "Nueva regla",
      content:
        "Crea una regla que genera movimientos automáticamente. Puede ser diaria, semanal, mensual, anual o de varios días al mes (p. ej. días 1 y 15).",
      placement: "bottom",
    },
    {
      target: '[data-tour="rec-manuales"]',
      title: "Tus reglas",
      content:
        "Las reglas que has creado tú (salario, alquiler, suscripciones…). Aquí ves su frecuencia, periodo y estado, y puedes editarlas o borrarlas.",
    },
    {
      target: '[data-tour="rec-vinculadas"]',
      title: "Reglas vinculadas",
      content:
        "Reglas creadas automáticamente al configurar la hipoteca, deudas o intereses de cuentas. Para cambiarlas, ve a su pantalla (no se editan aquí).",
    },
  ],

  "/inversiones": [
    {
      target: '[data-tour="inv-nueva"]',
      title: "Añadir inversión",
      content:
        "Crea una posición (acción/ETF, fondo, cripto, cuenta remunerada…). Al crearla registras la primera aportación (compra).",
      placement: "bottom",
    },
    {
      target: '[data-tour="inv-resumen"]',
      title: "Resumen de la cartera",
      content:
        "Valor actual de la cartera, coste total invertido y plusvalía (con su %). Se recalcula al actualizar cotizaciones.",
    },
    {
      target: '[data-tour="inv-valor-manual"]',
      title: "Actualizar valor a mano",
      content:
        "Pon el valor actual de la posición manualmente. Útil cuando la inversión no tiene cotización automática (sin ticker ni ISIN), como una cuenta remunerada o un activo no cotizado.",
    },
    {
      target: '[data-tour="inv-aportaciones"]',
      title: "Aportaciones",
      content:
        "En cada posición, este botón abre su historial de aportaciones y te permite configurar aportaciones periódicas automáticas.",
    },
  ],

  "/cuentas": [
    {
      target: '[data-tour="cuentas-nueva"]',
      title: "Añadir cuenta",
      content:
        "Crea una cuenta (banco, broker o efectivo) con su moneda y saldo inicial. Los saldos se calculan a partir de los movimientos.",
      placement: "bottom",
    },
    {
      target: '[data-tour="cuentas-conciliar"]',
      title: "Conciliar saldo",
      content:
        "Si el saldo real de la cuenta no coincide con el calculado, este botón crea un ajuste para cuadrarlo con lo que dice el banco.",
    },
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
