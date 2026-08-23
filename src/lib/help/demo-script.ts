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
  /** Abre un formulario real de la app (dialogo) ya rellenado, para explicarlo
   *  antes de aceptar. `name` identifica el formulario (lo escucha la pagina). */
  openForm: (name: string, values: Record<string, unknown>) => void;
  /** Cierra cualquier formulario abierto por el demo. */
  closeForm: () => void;
};

export type DemoStep = {
  navigate?: string;
  run?: (ctx: DemoContext) => Promise<void>;
  target?: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "right" | "auto";
  /** Paso que muestra un formulario real: la burbuja se coloca arriba y no
   *  oscurece el dialogo (que trae su propio fondo). */
  form?: boolean;
  /** Al pulsar «Siguiente», hace click en este boton (enviar/cerrar) antes de
   *  avanzar. Para pasos informativos con una accion automatica al pasar. */
  submitTarget?: string;
  /** Paso INTERACTIVO: el usuario debe pulsar ESTE elemento real (resaltado)
   *  para avanzar; el resto de la pantalla queda bloqueado. No hay «Siguiente».
   */
  clickTarget?: string;
  /** Zona que queda LIBRE (editable) durante un paso interactivo. Por defecto
   *  es el propio clickTarget; en formularios es TODO el dialogo, para que el
   *  usuario pueda rellenar cualquier campo antes de pulsar el boton. */
  holeTarget?: string;
  /** Validacion al pulsar el clickTarget: lee el DOM y devuelve un mensaje de
   *  aviso si algo no es valido (bloquea el clic real y no avanza), o null si
   *  todo esta bien. */
  validate?: (doc: Document) => string | null;
};

// --- Lectores del DOM para validar lo que el usuario ha escrito -------------

function numAt(doc: Document, sel: string): number {
  const el = doc.querySelector(sel);
  return el instanceof HTMLInputElement ? Number(el.value) : NaN;
}
function strAt(doc: Document, sel: string): string {
  const el = doc.querySelector(sel);
  return el instanceof HTMLInputElement ? el.value.trim() : "";
}
function selText(doc: Document, sel: string): string {
  return (doc.querySelector(sel)?.textContent ?? "").trim();
}

/** Busca el id de una categoria por su nombre. */
async function catId(
  ctx: DemoContext,
  nombre: string,
): Promise<string | undefined> {
  const cats = await ctx.repos.categories.list();
  return cats.find((c) => c.nombre === nombre)?.id;
}

// --- Guion -----------------------------------------------------------------

const FLUJO: DemoStep[] = [
  // --- Cuentas: banco (lo rellena el usuario) ---
  {
    navigate: "/cuentas",
    clickTarget: '[data-tour="cuentas-nueva"]',
    title: "Crear tu primera cuenta",
    content: "Para añadir una cuenta, pulsa el botón resaltado «Añadir cuenta».",
  },
  {
    run: async (ctx) => {
      // Prerellenamos entidad/tipo/moneda; el ALIAS y el SALDO los pones tú.
      ctx.openForm("account", {
        entidad: "Mi Banco",
        tipo: "Corriente",
        moneda: ctx.monedaLocal,
      });
    },
    holeTarget: '[data-tour="account-form"]',
    clickTarget: '[data-tour="account-form-submit"]',
    form: true,
    validate: (doc) => {
      const alias = strAt(doc, "#alias");
      const tipo = selText(doc, "#tipo-cuenta");
      const saldo = numAt(doc, "#saldoInicial");
      if (alias.length <= 3) return "Ponle un nombre (alias) de más de 3 letras.";
      if (tipo !== "Corriente") return "El tipo debe ser «Corriente».";
      if (!(saldo >= 5000)) return "El saldo inicial debe ser al menos 5.000 €.";
      return null;
    },
    title: "Rellena tú la cuenta",
    content:
      "Escribe un ALIAS (más de 3 letras), deja el TIPO en «Corriente» y pon un SALDO INICIAL de 5.000 € o más. Luego pulsa «Crear cuenta».",
  },
  // --- Cuentas: efectivo ---
  {
    clickTarget: '[data-tour="cuentas-nueva"]',
    title: "Añadir el efectivo",
    content:
      "El dinero en mano también es una cuenta. Pulsa otra vez «Añadir cuenta».",
  },
  {
    run: async (ctx) => {
      ctx.openForm("account", {
        entidad: "Efectivo",
        tipo: "Cash",
        moneda: ctx.monedaLocal,
      });
    },
    holeTarget: '[data-tour="account-form"]',
    clickTarget: '[data-tour="account-form-submit"]',
    form: true,
    validate: (doc) => {
      const alias = strAt(doc, "#alias");
      const tipo = selText(doc, "#tipo-cuenta");
      if (alias.length <= 3) return "Ponle un nombre (alias) de más de 3 letras.";
      if (tipo !== "Cash") return "El tipo debe ser «Cash».";
      return null;
    },
    title: "Cuenta de efectivo",
    content:
      "Ponle un alias (más de 3 letras) y deja el tipo en «Cash». El saldo puede quedarse en 0. Pulsa «Crear cuenta».",
  },
  {
    run: async (ctx) => {
      // Resolvemos por TIPO (el usuario eligio el alias libremente).
      const accs = await ctx.repos.accounts.list();
      const bank = accs.find((a) => a.tipo === "Corriente");
      if (bank) ctx.tracker.data.bankId = bank.id;
      const cash = accs.find((a) => a.tipo === "Cash");
      if (cash) ctx.tracker.data.cashId = cash.id;
      const v = await catId(ctx, "Vivienda");
      if (v) ctx.tracker.data.viviendaId = v;
      const r = await catId(ctx, "Restaurantes");
      if (r) ctx.tracker.data.restaurantesId = r;
    },
    target: '[data-tour="cuentas-tabla"]',
    title: "Tus cuentas",
    content:
      "Ya tienes tus dos cuentas. En esta tabla ves todas y su saldo (el banco y el efectivo).",
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
  // --- Categorias (las edita el usuario) ---
  {
    navigate: "/categorias",
    target: '[data-tour="cat-tabla"]',
    title: "Categorías",
    content:
      "Vienen unas categorías por defecto. Cada una puede tener un presupuesto mensual. Vamos a poner el de un par: lo haces tú.",
  },
  {
    clickTarget: '[data-demo="cat-editar-Vivienda"]',
    title: "Editar «Vivienda»",
    content: "Pulsa el botón editar (el lápiz) de la categoría «Vivienda».",
  },
  {
    holeTarget: '[data-tour="category-form"]',
    clickTarget: '[data-tour="category-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="category-form"] #presupuesto');
      if (!(v > 0)) return "Escribe un presupuesto mayor que 0 (por ejemplo, 500).";
      return null;
    },
    title: "Presupuesto de Vivienda",
    content:
      "Escribe el presupuesto mensual (por ejemplo, 500 €) y pulsa «Guardar cambios».",
  },
  {
    clickTarget: '[data-demo="cat-editar-Restaurantes"]',
    title: "Editar «Restaurantes»",
    content: "Ahora la categoría «Restaurantes»: pulsa su botón editar.",
  },
  {
    holeTarget: '[data-tour="category-form"]',
    clickTarget: '[data-tour="category-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="category-form"] #presupuesto');
      if (!(v > 0)) return "Escribe un presupuesto mayor que 0 (por ejemplo, 150).";
      return null;
    },
    title: "Presupuesto de Restaurantes",
    content:
      "Escribe su presupuesto (por ejemplo, 150 €) y pulsa «Guardar cambios».",
  },
  // --- Movimientos: transferencia (sacar dinero) ---
  {
    navigate: "/movimientos",
    clickTarget: '[data-tour="mov-nuevo"]',
    title: "Registrar un movimiento",
    content:
      "Aquí van gastos, ingresos, transferencias y ajustes. Empecemos sacando dinero del banco: pulsa «Movimiento».",
  },
  {
    run: async (ctx) => {
      ctx.openForm("movement", {
        tipo: "transferencia",
        values: {
          concepto: "Sacar efectivo",
          moneda: ctx.monedaLocal,
          cuentaOrigenId: ctx.tracker.data.bankId,
          cuentaDestinoId: ctx.tracker.data.cashId,
        },
      });
    },
    holeTarget: '[data-tour="movement-form"]',
    clickTarget: '[data-tour="movement-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="movement-form"] [data-tour="mov-form-importe"]');
      if (v !== 200) return "Pon 200 € de importe.";
      return null;
    },
    title: "Sacar dinero = transferencia",
    content:
      "Una TRANSFERENCIA mueve dinero entre tus cuentas (no es gasto ni ingreso): del banco al efectivo. Escribe 200 € y pulsa «Crear movimiento».",
  },
  {
    navigate: "/cuentas",
    target: '[data-tour="cuentas-tabla"]',
    title: "Mira cómo cambian los saldos",
    content:
      "En el banco hay 200 € menos y en efectivo 200 € más. Las transferencias no cuentan como gasto ni ingreso.",
  },
  // --- Movimientos: un gasto ---
  {
    navigate: "/movimientos",
    clickTarget: '[data-tour="mov-nuevo"]',
    title: "Registrar un gasto",
    content: "Ahora un gasto. Pulsa otra vez «Movimiento».",
  },
  {
    run: async (ctx) => {
      ctx.openForm("movement", {
        tipo: "gasto",
        values: {
          concepto: "Cena con amigos",
          moneda: ctx.monedaLocal,
          cuentaOrigenId: ctx.tracker.data.bankId,
          categoriaId: ctx.tracker.data.restaurantesId,
        },
      });
    },
    holeTarget: '[data-tour="movement-form"]',
    clickTarget: '[data-tour="movement-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="movement-form"] [data-tour="mov-form-importe"]');
      if (v !== 100) return "El gasto de la cena debe ser 100 €.";
      return null;
    },
    title: "Un gasto",
    content:
      "Sale dinero de una cuenta y se asigna a una categoría: una cena pagada con el banco, en Restaurantes. Escribe 100 € y pulsa «Crear movimiento».",
  },
  // --- Movimientos: devoluciones del gasto (via su botón ↩), a mano ---
  {
    target: '[data-tour="mov-devolucion"]',
    clickTarget: '[data-tour="mov-devolucion"]',
    title: "Devoluciones de un gasto",
    content:
      "Imagina que pagaste tú y tus amigos te devuelven su parte. Pulsa el botón ↩ de la fila de la cena.",
  },
  {
    holeTarget: '[data-tour="refunds-dialog"]',
    clickTarget: '[data-tour="refund-add"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="refunds-dialog"] #r-importe');
      if (v !== 25) return "Escribe 25 € en el importe.";
      return null;
    },
    title: "Devolución 1 de 3",
    content:
      "Un amigo te devuelve su parte. Escribe 25 €, elige tu BANCO en «Entra en la cuenta» y pulsa «Añadir devolución».",
  },
  {
    holeTarget: '[data-tour="refunds-dialog"]',
    clickTarget: '[data-tour="refund-add"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="refunds-dialog"] #r-importe');
      if (v !== 25) return "Escribe 25 € en el importe.";
      return null;
    },
    title: "Devolución 2 de 3",
    content:
      "Otro amigo, otros 25 € al BANCO. Escribe 25, elige el banco y pulsa «Añadir devolución».",
  },
  {
    holeTarget: '[data-tour="refunds-dialog"]',
    clickTarget: '[data-tour="refund-add"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="refunds-dialog"] #r-importe');
      if (v !== 25) return "Escribe 25 € en el importe.";
      return null;
    },
    title: "Devolución 3 de 3",
    content:
      "La última: 25 € al EFECTIVO. Escribe 25, elige efectivo y pulsa «Añadir devolución».",
  },
  {
    target: '[data-tour="refunds-dialog"]',
    form: true,
    submitTarget: '[data-tour="refunds-dialog"] [data-slot="dialog-close"]',
    title: "Coste real",
    content:
      "Ya están las tres: 75 € devueltos y coste real 25 €. Pagaste 100 pero solo te ha costado 25. Pulsa «Siguiente».",
  },
  {
    target: '[data-tour="mov-lista"]',
    title: "El gasto, ya con su coste real",
    content:
      "En la lista, el gasto de la cena muestra ahora las devoluciones y su coste real (25 €), no los 100 € que adelantaste.",
  },
  // --- Recurrentes: gasto recurrente ---
  {
    navigate: "/recurrentes",
    clickTarget: '[data-tour="rec-nuevo"]',
    title: "Automatizar lo que se repite",
    content:
      "Las reglas recurrentes generan movimientos solas. Pulsa «Nueva regla» para crear la primera.",
  },
  {
    run: async (ctx) => {
      ctx.openForm("recurring", {
        nombre: "Alquiler",
        tipoMovimiento: "gasto",
        moneda: ctx.monedaLocal,
        cuentaOrigenId: ctx.tracker.data.bankId,
        categoriaId: ctx.tracker.data.viviendaId,
        diaDelMes: 1,
        frecuencia: "mensual",
      });
    },
    holeTarget: '[data-tour="recurring-form"]',
    clickTarget: '[data-tour="recurring-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="recurring-form"] #r-importe');
      if (v !== 500) return "El alquiler debe ser 500 €.";
      return null;
    },
    title: "Un gasto recurrente",
    content:
      "El «Alquiler»: cada mes el día 1, desde el banco, categoría Vivienda. Escribe 500 € y pulsa «Crear regla».",
  },
  // --- Recurrentes: ingreso recurrente ---
  {
    clickTarget: '[data-tour="rec-nuevo"]',
    title: "Un ingreso recurrente",
    content: "Y ahora la nómina. Pulsa otra vez «Nueva regla».",
  },
  {
    run: async (ctx) => {
      ctx.openForm("recurring", {
        nombre: "Nómina",
        tipoMovimiento: "ingreso",
        moneda: ctx.monedaLocal,
        cuentaDestinoId: ctx.tracker.data.bankId,
        categoriaTexto: "Nómina",
        diaDelMes: 28,
        frecuencia: "mensual",
      });
    },
    holeTarget: '[data-tour="recurring-form"]',
    clickTarget: '[data-tour="recurring-form-submit"]',
    form: true,
    validate: (doc) => {
      const v = numAt(doc, '[data-tour="recurring-form"] #r-importe');
      if (v !== 1500) return "La nómina debe ser 1.500 €.";
      return null;
    },
    title: "La nómina",
    content:
      "La «Nómina»: cada mes el día 28, al banco. Escribe 1.500 € y pulsa «Crear regla».",
  },
  {
    target: '[data-tour="rec-manuales"]',
    title: "Tus recurrentes",
    content:
      "Aquí están tus reglas. La app las ejecuta sola al arrancar cuando toca; puedes editarlas o desactivarlas cuando quieras.",
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

/** Guion completo: bienvenida + botón de ayuda + flujo de ejemplo. */
export const DEMO_STEPS: DemoStep[] = [
  {
    title: "Bienvenido a Finanzas 👋",
    content:
      "Te enseño la app con un ejemplo práctico, en una cuenta de prueba (tus datos no se tocan). Al terminar, vuelves a lo tuyo.",
  },
  {
    target: '[data-tour="menu-help"]',
    title: "Ayuda siempre a mano",
    content:
      "Con este botón «?» tienes una guía de cada sección. Y en cada pantalla, el «?» de arriba explica lo que ves. Ahora, el ejemplo:",
    placement: "right",
  },
  ...FLUJO,
];
