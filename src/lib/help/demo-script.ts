/**
 * ============================================================================
 *  src/lib/help/demo-script.ts — Guion del DEMO interactivo (onboarding)
 * ============================================================================
 *
 *  El demo crea datos de EJEMPLO por debajo (marcados "(demo)"), navega y
 *  explica, y al terminar BORRA todo lo creado (hard delete) y restaura los
 *  presupuestos que toco. Nunca modifica datos reales de forma permanente.
 *
 *  Flujo: guia del menu -> Cuentas (banco + efectivo) -> Ajustes (moneda +
 *  cuenta principal) -> Categorias (editar 2 presupuestos) -> Movimientos
 *  (transferencia; luego cena con devoluciones) -> ver Cuentas -> Recurrentes
 *  (gasto + ingreso) -> Dashboard -> fin + limpieza.
 * ============================================================================
 */

import type { Repositories } from "@/lib/repositories";
import { MENU_TOUR } from "./tours";
import { normalizeDateToUTCNoon } from "@/lib/utils/dates";

/** Registro de lo creado por el demo, para poder borrarlo al terminar. */
export type DemoTracker = {
  accountIds: string[];
  movementIds: string[];
  ruleIds: string[];
  budgetBackups: { id: string; importe: number; moneda: string }[];
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
  navigate?: string;
  run?: (ctx: DemoContext) => Promise<void>;
  target?: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "right" | "auto";
};

// --- Helpers de creacion ---------------------------------------------------

async function crearCuenta(
  ctx: DemoContext,
  alias: string,
  tipo: string,
  saldoInicial: number,
): Promise<string> {
  const acc = await ctx.repos.accounts.create({
    entidad: alias,
    tipo,
    alias,
    saldoInicial,
    moneda: ctx.monedaLocal,
    activa: true,
    notas: "demo",
  });
  ctx.tracker.accountIds.push(acc.id);
  return acc.id;
}

async function editarPresupuesto(
  ctx: DemoContext,
  nombre: string,
  importe: number,
): Promise<string | null> {
  const cats = await ctx.repos.categories.list();
  const cat = cats.find((c) => c.nombre === nombre);
  if (!cat) return null;
  ctx.tracker.budgetBackups.push({
    id: cat.id,
    importe: cat.presupuestoMensual,
    moneda: cat.presupuestoMoneda,
  });
  await ctx.repos.categories.update(cat.id, {
    presupuestoMensual: importe,
    presupuestoMoneda: ctx.monedaLocal,
  });
  return cat.id;
}

async function crearMovimiento(
  ctx: DemoContext,
  data: Parameters<Repositories["movements"]["create"]>[0],
): Promise<string> {
  const m = await ctx.repos.movements.create(data);
  ctx.tracker.movementIds.push(m.id);
  return m.id;
}

// --- Guion -----------------------------------------------------------------

const FLUJO: DemoStep[] = [
  // --- Cuentas ---
  {
    navigate: "/cuentas",
    run: async (ctx) => {
      ctx.tracker.data.bankId = await crearCuenta(ctx, "Banco (demo)", "Banco", 5000);
    },
    target: '[data-tour="cuentas-tabla"]',
    title: "Cuentas",
    content:
      "He creado una cuenta de banco de ejemplo con 5.000 €. Aquí ves todas tus cuentas y su saldo (botón «Añadir cuenta»).",
  },
  {
    run: async (ctx) => {
      ctx.tracker.data.cashId = await crearCuenta(ctx, "Efectivo (demo)", "Efectivo", 0);
    },
    target: '[data-tour="cuentas-tabla"]',
    title: "El efectivo también es una cuenta",
    content:
      "Añadí una cuenta de «Efectivo». El dinero en mano se gestiona como una cuenta más, para poder cuadrarlo.",
  },
  // --- Ajustes ---
  {
    navigate: "/ajustes",
    target: '[data-tour="aj-monedas"]',
    title: "Moneda",
    content:
      "En Ajustes eliges tu moneda local (en la que operas) y la de visualización (en la que se muestran los totales).",
    placement: "bottom",
  },
  {
    target: '[data-tour="aj-cuenta-principal"]',
    title: "Cuenta principal",
    content:
      "Y tu cuenta por defecto: la que se precarga al crear un gasto (de donde saldrá la mayoría). Recuerda pulsar «Guardar ajustes».",
  },
  // --- Categorias ---
  {
    navigate: "/categorias",
    target: '[data-tour="cat-tabla"]',
    title: "Categorías",
    content:
      "Vienen unas categorías por defecto. Cada una puede tener un presupuesto mensual. Voy a ponerle presupuesto a un par.",
  },
  {
    run: async (ctx) => {
      const id = await editarPresupuesto(ctx, "Vivienda", 500);
      if (id) ctx.tracker.data.viviendaId = id;
    },
    target: '[data-tour="cat-tabla"]',
    title: "Presupuesto de Vivienda",
    content: "He puesto el presupuesto de «Vivienda» en 500 € al mes.",
  },
  {
    run: async (ctx) => {
      const id = await editarPresupuesto(ctx, "Restaurantes", 150);
      if (id) ctx.tracker.data.restaurantesId = id;
    },
    target: '[data-tour="cat-tabla"]',
    title: "Presupuesto de Restaurantes",
    content: "Y el de «Restaurantes» en 150 € al mes.",
  },
  // --- Movimientos: transferencia (sacar dinero) ---
  {
    navigate: "/movimientos",
    target: '[data-tour="mov-nuevo"]',
    title: "Movimientos",
    content:
      "Aquí registras gastos, ingresos, transferencias y ajustes. Ejemplo: sacar dinero del banco es una TRANSFERENCIA a la cuenta de efectivo.",
    placement: "bottom",
  },
  {
    run: async (ctx) => {
      const f = normalizeDateToUTCNoon(new Date());
      await crearMovimiento(ctx, {
        tipo: "transferencia",
        fecha: f,
        mes: f.getUTCMonth() + 1,
        anio: f.getUTCFullYear(),
        concepto: "Sacar efectivo (demo)",
        importe: 200,
        moneda: ctx.monedaLocal,
        cuentaOrigenId: ctx.tracker.data.bankId,
        cuentaDestinoId: ctx.tracker.data.cashId,
        esAutomatico: false,
      });
    },
    target: '[data-tour="mov-lista"]',
    title: "Transferencia creada",
    content:
      "He sacado 200 € del banco a efectivo con una transferencia. No es un gasto: solo mueve dinero entre tus cuentas.",
  },
  {
    navigate: "/cuentas",
    target: '[data-tour="cuentas-tabla"]',
    title: "Mira cómo cambian los saldos",
    content:
      "En el banco hay 200 € menos y en efectivo 200 € más. Las transferencias no cuentan como gasto ni ingreso.",
  },
  // --- Movimientos: cena con devoluciones ---
  {
    navigate: "/movimientos",
    run: async (ctx) => {
      const f = normalizeDateToUTCNoon(new Date());
      const mes = f.getUTCMonth() + 1;
      const anio = f.getUTCFullYear();
      const gastoId = await crearMovimiento(ctx, {
        tipo: "gasto",
        fecha: f,
        mes,
        anio,
        concepto: "Cena con amigos (demo)",
        importe: 100,
        moneda: ctx.monedaLocal,
        cuentaOrigenId: ctx.tracker.data.bankId,
        categoriaId: ctx.tracker.data.restaurantesId ?? null,
        esAutomatico: false,
      });
      // Tres devoluciones: 25 + 25 al banco, 25 en efectivo.
      const dev = (importe: number, cuentaDestinoId: string | undefined) =>
        crearMovimiento(ctx, {
          tipo: "devolucion",
          fecha: f,
          mes,
          anio,
          concepto: "Devolución: Cena con amigos (demo)",
          importe,
          moneda: ctx.monedaLocal,
          cuentaDestinoId: cuentaDestinoId ?? null,
          categoriaId: ctx.tracker.data.restaurantesId ?? null,
          gastoAsociadoId: gastoId,
          esAutomatico: false,
        });
      await dev(25, ctx.tracker.data.bankId);
      await dev(25, ctx.tracker.data.bankId);
      await dev(25, ctx.tracker.data.cashId);
    },
    target: '[data-tour="mov-lista"]',
    title: "Una cena a medias",
    content:
      "Cena de 100 € que pagaste tú y dividís entre 4. Registré el gasto de 100 € y 3 devoluciones: 25 + 25 a tu banco y 25 en efectivo. Tu coste real: 25 €.",
  },
  {
    navigate: "/cuentas",
    target: '[data-tour="cuentas-tabla"]',
    title: "Efecto de la cena",
    content:
      "Por la cena: en el banco 50 € menos (pagaste 100 y te devolvieron 50) y en efectivo 25 € más. El gasto real de la cena es 25 €.",
  },
  // --- Recurrentes ---
  {
    navigate: "/recurrentes",
    run: async (ctx) => {
      const fecha = normalizeDateToUTCNoon(new Date());
      const alquiler = await ctx.repos.recurringRules.create({
        nombre: "Alquiler (demo)",
        tipoMovimiento: "gasto",
        importe: 500,
        moneda: ctx.monedaLocal,
        cuentaOrigenId: ctx.tracker.data.bankId,
        categoriaId: ctx.tracker.data.viviendaId ?? null,
        diaDelMes: 1,
        fechaInicio: fecha,
        frecuencia: "mensual",
        activa: true,
      });
      ctx.tracker.ruleIds.push(alquiler.id);
      const nomina = await ctx.repos.recurringRules.create({
        nombre: "Nómina (demo)",
        tipoMovimiento: "ingreso",
        importe: 1500,
        moneda: ctx.monedaLocal,
        cuentaDestinoId: ctx.tracker.data.bankId,
        categoriaTexto: "Nómina",
        diaDelMes: 28,
        fechaInicio: fecha,
        frecuencia: "mensual",
        activa: true,
      });
      ctx.tracker.ruleIds.push(nomina.id);
    },
    target: '[data-tour="rec-manuales"]',
    title: "Movimientos recurrentes",
    content:
      "Automatiza lo que se repite: creé el «Alquiler» (gasto mensual) y la «Nómina» (ingreso mensual). Pueden ser diarios, semanales, mensuales o anuales.",
  },
  // --- Dashboard ---
  {
    navigate: "/dashboard",
    target: '[data-tour="dashboard-kpis"]',
    title: "Tu panel",
    content:
      "Y este es el Dashboard: el resumen de tu mes (ingresos, gastos, ahorro y patrimonio). Fin de la guía: ahora borro los datos de ejemplo.",
  },
];

/** Guion completo: guia del menu + flujo. */
export const DEMO_STEPS: DemoStep[] = [
  {
    title: "Bienvenido a Finanzas 👋",
    content:
      "Te enseño la app con un ejemplo práctico. Iré creando datos de prueba y, al terminar, los borro todos. Empecemos por el menú de la izquierda.",
  },
  // Guia del menu (sin su intro propia, ya tenemos la bienvenida).
  ...(MENU_TOUR.slice(1) as DemoStep[]),
  ...FLUJO,
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
