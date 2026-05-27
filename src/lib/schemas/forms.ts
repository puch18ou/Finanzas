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
 *    1. Validacion en runtime:
 *         const result = ExpenseSchema.safeParse(data);
 *         if (!result.success) console.log(result.error.format());
 *
 *    2. Tipo TypeScript inferido:
 *         type Expense = z.infer<typeof ExpenseSchema>;
 *
 *    3. Mensajes de error custom:
 *         z.number().min(0, "El importe no puede ser negativo")
 *
 *  Aqui definimos los esquemas de los DATOS DE LOS FORMULARIOS, no de
 *  las filas de la BD. Diferencias:
 *
 *    - Las filas de BD tienen `id`, `createdAt`, `updatedAt`, etc., que
 *      se generan automaticamente. Los formularios no los piden.
 *    - Los formularios pueden tener campos no-finales (string vacio que
 *      se convierte a null al guardar).
 * ============================================================================
 */

import { z } from "zod";

// ============================================================================
//  CATEGORIA
// ============================================================================

export const categoryFormSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(60, "Maximo 60 caracteres"),
  tipo: z
    .string()
    .min(1, "Selecciona un tipo")
    .max(40, "Maximo 40 caracteres"),
  presupuestoMensual: z
    .number({ message: "Debe ser un numero" })
    .min(0, "El presupuesto no puede ser negativo"),
  presupuestoMoneda: z
    .string()
    .min(2, "Selecciona una moneda")
    .max(4),
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

/**
 * Esquema para crear/editar un gasto.
 *
 * Notas de diseño:
 *  - `fecha` es Date (no string). Los componentes Calendar de shadcn la
 *    manejan asi. Para inputs nativos type=date, usaremos un schema
 *    distinto (quickExpense) que la recibe como string.
 *  - `cuentaId` es opcional: puedes registrar un gasto sin saber de que
 *    cuenta salio (luego lo enlazas).
 *  - El presupuesto check (`presupuestoMensual >= 0`) lo hace el repo.
 *    Aqui solo validamos forma.
 */
export const expenseFormSchema = z.object({
  fecha: z.date({ message: "Fecha obligatoria" }),
  concepto: z
    .string()
    .min(1, "El concepto es obligatorio")
    .max(200, "Maximo 200 caracteres"),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
  importe: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("El importe no puede ser negativo"),
  moneda: z.string().min(2).max(4),
  cuentaId: z.string().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

export type ExpenseFormData = z.infer<typeof expenseFormSchema>;

/**
 * Variante del schema para el "añadido rápido": acepta fecha como string
 * 'YYYY-MM-DD' (input nativo type=date). Lo convertimos a Date en la capa
 * de aplicacion antes de pasar al repo.
 *
 * Sin notas ni cuentaId, solo lo esencial.
 */
export const quickExpenseFormSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  concepto: z.string().min(1, "Concepto obligatorio").max(200),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
  importe: z.number({ message: "Debe ser un numero" }).nonnegative(),
  moneda: z.string().min(2).max(4),
});

export type QuickExpenseFormData = z.infer<typeof quickExpenseFormSchema>;

// ============================================================================
//  INGRESO MENSUAL (fila editable inline)
// ============================================================================

/**
 * Esquema para editar UNA fila de ingresos mensuales. (anio, mes, moneda)
 * no van porque son la clave; solo se editan los importes y las notas.
 */
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
  concepto: z
    .string()
    .min(1, "El concepto es obligatorio")
    .max(200),
  categoria: z
    .string()
    .min(1, "Selecciona o escribe una categoria")
    .max(40),
  tipo: z.string().min(1).max(40).default("Ingreso extra"),
  importe: z.number({ message: "Debe ser un numero" }).positive("Debe ser positivo"),
  moneda: z.string().min(2).max(4),
  notas: z.string().max(500).nullable().optional(),
});

export type ExtraIncomeFormData = z.infer<typeof extraIncomeFormSchema>;

/**
 * Sugerencias de categoria para ingresos puntuales. El usuario puede
 * escribir cualquier otra (campo libre).
 */
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
