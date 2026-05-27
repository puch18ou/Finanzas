/**
 * ============================================================================
 *  src/lib/schemas/forms.ts — Esquemas Zod para los formularios CRUD
 * ============================================================================
 *
 *  CONCEPTO ZOD (refresher Pydantic-style)
 *  ---------------------------------------
 *  Zod es a TypeScript lo que Pydantic es a Python. Defines un "schema":
 *
 *      const ExpenseSchema = z.object({
 *        importe: z.number().positive(),
 *        moneda: z.enum(['EUR','USD','SGD']),
 *      });
 *
 *  Y obtienes tres cosas:
 *
 *    1. Validacion en runtime
 *    2. Tipo TypeScript inferido via z.infer
 *    3. Mensajes de error custom
 * ============================================================================
 */

import { z } from "zod";

// ============================================================================
//  CATEGORIA
// ============================================================================

export const categoryFormSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(60),
  tipo: z.string().min(1, "Selecciona un tipo").max(40),
  presupuestoMensual: z
    .number({ message: "Debe ser un numero" })
    .min(0, "El presupuesto no puede ser negativo"),
  presupuestoMoneda: z.string().min(2, "Selecciona una moneda").max(4),
  notas: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color debe ser HEX (#RRGGBB)")
    .nullable()
    .optional(),
  icono: z.string().max(40).nullable().optional(),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;

export const TIPOS_CATEGORIA = [
  "Esencial",
  "Ocio",
  "Personal",
  "Inversion personal",
  "Variable",
] as const;

// ============================================================================
//  MONEDA
// ============================================================================

export const currencyFormSchema = z.object({
  code: z
    .string()
    .min(2, "Minimo 2 caracteres")
    .max(5, "Maximo 5 caracteres")
    .regex(/^[A-Z0-9]+$/, "Solo mayusculas y digitos (ej. EUR, USDT)")
    .transform((s) => s.toUpperCase()),
  nombre: z.string().min(1, "El nombre es obligatorio").max(60),
  simbolo: z.string().min(1, "El simbolo es obligatorio").max(5),
  tipoCambioVista: z
    .number({ message: "Debe ser un numero" })
    .positive("El tipo de cambio debe ser positivo"),
  orden: z.number().int().min(0),
  activa: z.boolean(),
});

export type CurrencyFormData = z.infer<typeof currencyFormSchema>;

// ============================================================================
//  CUENTA
// ============================================================================

export const accountFormSchema = z.object({
  entidad: z.string().min(1, "Entidad obligatoria").max(60),
  tipo: z.enum(["Corriente", "Ahorro", "Broker", "Cash", "Credito"], {
    message: "Selecciona un tipo de cuenta",
  }),
  alias: z.string().min(1, "El alias es obligatorio").max(60),
  saldo: z.number({ message: "Debe ser un numero" }),
  moneda: z.string().min(2).max(4),
  activa: z.boolean(),
  notas: z.string().max(500).nullable().optional(),
});

export type AccountFormData = z.infer<typeof accountFormSchema>;

export const TIPOS_CUENTA = [
  "Corriente",
  "Ahorro",
  "Broker",
  "Cash",
  "Credito",
] as const;

// ============================================================================
//  GASTO
// ============================================================================

export const expenseFormSchema = z.object({
  fecha: z.date({ message: "Fecha obligatoria" }),
  concepto: z.string().min(1, "El concepto es obligatorio").max(200),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
  importe: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("El importe no puede ser negativo"),
  moneda: z.string().min(2).max(4),
  cuentaId: z.string().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

export type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export const quickExpenseFormSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  concepto: z.string().min(1, "Concepto obligatorio").max(200),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
  importe: z.number({ message: "Debe ser un numero" }).nonnegative(),
  moneda: z.string().min(2).max(4),
});

export type QuickExpenseFormData = z.infer<typeof quickExpenseFormSchema>;

// ============================================================================
//  INGRESO MENSUAL
// ============================================================================

export const monthlyIncomeFormSchema = z.object({
  salario: z.number({ message: "Debe ser un numero" }).nonnegative(),
  bonus: z.number().nonnegative(),
  otros: z.number().nonnegative(),
  moneda: z.string().min(2).max(4),
  notas: z.string().max(500).nullable().optional(),
});

export type MonthlyIncomeFormData = z.infer<typeof monthlyIncomeFormSchema>;

// ============================================================================
//  INGRESO PUNTUAL
// ============================================================================

export const extraIncomeFormSchema = z.object({
  fecha: z.date({ message: "Fecha obligatoria" }),
  concepto: z.string().min(1, "El concepto es obligatorio").max(200),
  categoria: z.string().min(1, "Selecciona o escribe una categoria").max(40),
  tipo: z.string().min(1).max(40).default("Ingreso extra"),
  importe: z.number({ message: "Debe ser un numero" }).positive("Debe ser positivo"),
  moneda: z.string().min(2).max(4),
  notas: z.string().max(500).nullable().optional(),
});

export type ExtraIncomeFormData = z.infer<typeof extraIncomeFormSchema>;

export const CATEGORIAS_INGRESO_EXTRA = [
  "Bonus",
  "Premio",
  "Regalo",
  "Reembolso",
  "Venta",
  "Dividendos",
  "Intereses",
  "Otros",
] as const;

// ============================================================================
//  INVERSION
// ============================================================================

/**
 * Tipos de inversion soportados. El usuario tambien puede escribir tipos
 * custom (campo libre con sugerencias).
 */
export const TIPOS_INVERSION = [
  "Acciones",
  "ETF",
  "Fondo",
  "Cripto",
  "Bono",
  "Plan pensiones",
  "Inmueble",
  "Otro",
] as const;

/**
 * Esquema del formulario de inversion. Campos:
 *  - tipo, ticker (opcional), nombre
 *  - participaciones, precioCompra, precioActual, moneda
 *  - cuentaId (broker = cuenta de tipo Broker, opcional)
 *  - fechaCompra (opcional), notas (opcional)
 *
 * NOTA: el schema de BD tiene `precioCompra` (no `precioCompraMedio`)
 * y NO tiene campo `broker` separado; usamos `cuentaId` apuntando a la
 * cuenta del broker.
 */
export const investmentFormSchema = z.object({
  tipo: z.string().min(1, "Selecciona un tipo").max(40),
  ticker: z.string().max(20).nullable().optional(),
  nombre: z.string().min(1, "El nombre es obligatorio").max(120),
  participaciones: z
    .number({ message: "Debe ser un numero" })
    .positive("Debe ser mayor que 0"),
  precioCompra: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  precioActual: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  moneda: z.string().min(2).max(4),
  cuentaId: z.string().nullable().optional(),
  fechaCompra: z.date().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

export type InvestmentFormData = z.infer<typeof investmentFormSchema>;

// ============================================================================
//  META DE AHORRO
// ============================================================================

export const goalFormSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(80),
  importeObjetivo: z
    .number({ message: "Debe ser un numero" })
    .positive("El objetivo debe ser positivo"),
  yaAhorrado: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  moneda: z.string().min(2).max(4),
  fechaObjetivo: z.date({ message: "Fecha objetivo obligatoria" }),
  cuentaVinculadaId: z.string().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

export type GoalFormData = z.infer<typeof goalFormSchema>;
