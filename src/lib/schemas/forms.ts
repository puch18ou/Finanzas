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
 *  USO EN ESTE PROYECTO
 *  --------------------
 *  Aqui definimos los esquemas de los DATOS DE LOS FORMULARIOS, no de
 *  las filas de la BD. Diferencias:
 *
 *    - Las filas de BD tienen `id`, `createdAt`, `updatedAt`, etc., que
 *      se generan automaticamente. Los formularios no los piden.
 *    - Los formularios pueden tener campos no-finales (string vacio que
 *      se convierte a null al guardar).
 *    - Los formularios validan reglas que en BD podrian ser solo CHECK
 *      constraints (e.g. "el presupuesto no puede ser negativo").
 *
 *  Los formularios usaran react-hook-form + zodResolver para integrar
 *  estos esquemas como validacion automatica de los inputs.
 * ============================================================================
 */

import { z } from "zod";

// ============================================================================
//  CATEGORIA
// ============================================================================

/**
 * Esquema para el formulario de crear/editar categoria.
 * Los campos opcionales se pueden dejar vacios en el form.
 */
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

/**
 * Tipos comunes preestablecidos. Aparecen como sugerencias en el select
 * pero el usuario puede teclear cualquier otro.
 */
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

/**
 * Esquema para crear/editar una moneda.
 * El codigo se valida como 3-4 caracteres alfabeticos (ISO 4217 + algun
 * margen para tokens crypto si quisieramos).
 */
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
