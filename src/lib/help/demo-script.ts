/**
 * ============================================================================
 *  src/lib/help/demo-script.ts — Guion del DEMO interactivo (onboarding)
 * ============================================================================
 *
 *  El demo crea datos de EJEMPLO por debajo (marcados "(demo)"), navega y
 *  explica, y al terminar BORRA todo lo creado (hard delete) y restaura los
 *  presupuestos que toco. Nunca modifica datos reales de forma permanente.
 *
 *  FASE 1 (prueba): bienvenida -> Cuentas (crea banco 5000 + efectivo) ->
 *  Dashboard -> fin + limpieza. Se ampliara con categorias, movimientos,
 *  devoluciones y recurrentes.
 * ============================================================================
 */

import type { Repositories } from "@/lib/repositories";

/** Registro de lo creado por el demo, para poder borrarlo al terminar. */
export type DemoTracker = {
  accountIds: string[];
  movementIds: string[];
  ruleIds: string[];
  /** Presupuestos de categoria tocados, para restaurarlos. */
  budgetBackups: { id: string; importe: number; moneda: string }[];
  /** Datos compartidos entre pasos (p.ej. ids de las cuentas creadas). */
  data: Record<string, string>;
};

export function newDemoTracker(): DemoTracker {
  return {
    accountIds: [],
    movementIds: [],
    ruleIds: [],
    budgetBackups: [],
    data: {},
  };
}

export type DemoContext = {
  repos: Repositories;
  monedaLocal: string;
  tracker: DemoTracker;
};

export type DemoStep = {
  /** Ruta a la que navegar antes del paso. */
  navigate?: string;
  /** Accion (crear/editar datos) antes de mostrar la burbuja. */
  run?: (ctx: DemoContext) => Promise<void>;
  /** Selector del elemento a resaltar. Si falta o no existe, paso centrado. */
  target?: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "right" | "auto";
};

export const DEMO_STEPS: DemoStep[] = [
  {
    title: "Bienvenido a Finanzas 👋",
    content:
      "Te enseño la app con un ejemplo práctico. Iré creando datos de prueba a medida que avanzo y, al terminar, los borro todos. Pulsa «Siguiente».",
  },
  {
    navigate: "/cuentas",
    run: async (ctx) => {
      const bank = await ctx.repos.accounts.create({
        entidad: "Banco Demo",
        tipo: "Banco",
        alias: "Banco (demo)",
        saldoInicial: 5000,
        moneda: ctx.monedaLocal,
        activa: true,
        notas: "demo",
      });
      ctx.tracker.accountIds.push(bank.id);
      ctx.tracker.data.bankId = bank.id;
    },
    target: '[data-tour="cuentas-tabla"]',
    title: "Cuentas",
    content:
      "He creado una cuenta de banco de ejemplo con 5.000 €. Aquí ves todas tus cuentas y su saldo. Se crean con el botón «Añadir cuenta».",
  },
  {
    run: async (ctx) => {
      const cash = await ctx.repos.accounts.create({
        entidad: "Efectivo",
        tipo: "Efectivo",
        alias: "Efectivo (demo)",
        saldoInicial: 0,
        moneda: ctx.monedaLocal,
        activa: true,
        notas: "demo",
      });
      ctx.tracker.accountIds.push(cash.id);
      ctx.tracker.data.cashId = cash.id;
    },
    target: '[data-tour="cuentas-tabla"]',
    title: "El efectivo también es una cuenta",
    content:
      "He añadido una cuenta de «Efectivo». El dinero en mano se gestiona como una cuenta más, para poder cuadrarlo.",
  },
  {
    navigate: "/dashboard",
    target: '[data-tour="dashboard-kpis"]',
    title: "El panel",
    content:
      "El Dashboard resume tu mes: ingresos, gastos, ahorro y patrimonio. Y hasta aquí la demo: ahora borro los datos de ejemplo.",
  },
];

/** Borra todo lo creado por el demo y restaura los presupuestos tocados. */
export async function cleanupDemo(ctx: DemoContext): Promise<void> {
  for (const id of ctx.tracker.movementIds) {
    try {
      await ctx.repos.movements.hardDelete(id);
    } catch {
      /* ignorar */
    }
  }
  for (const id of ctx.tracker.ruleIds) {
    try {
      await ctx.repos.recurringRules.hardDelete(id);
    } catch {
      /* ignorar */
    }
  }
  for (const id of ctx.tracker.accountIds) {
    try {
      await ctx.repos.accounts.hardDelete(id);
    } catch {
      /* ignorar */
    }
  }
  for (const b of ctx.tracker.budgetBackups) {
    try {
      await ctx.repos.categories.update(b.id, {
        presupuestoMensual: b.importe,
        presupuestoMoneda: b.moneda,
      });
    } catch {
      /* ignorar */
    }
  }
}
