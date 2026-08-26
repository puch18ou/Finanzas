/**
 * ============================================================================
 *  src/lib/schemas/forms.ts — Esquemas Zod para los formularios CRUD
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
  saldoInicial: z.number({ message: "Debe ser un numero" }),
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

export const TIPOS_INVERSION = [
  "Acciones",
  "ETF",
  "Fondo",
  "Cripto",
  "Materias primas",
  "Bono",
  "Plan pensiones",
  "Inmueble",
  "Cartera de fondos",
  "Cuenta remunerada",
  "Otro",
] as const;

export const investmentFormSchema = z.object({
  tipo: z.string().min(1, "Selecciona un tipo").max(40),
  ticker: z.string().max(20).nullable().optional(),
  // ISIN (12 caracteres). Sirve para resolver el simbolo de cotizacion y como
  // identificador del activo. Opcional.
  isin: z.string().max(12).nullable().optional(),
  nombre: z.string().min(1, "El nombre es obligatorio").max(120),
  // Solo aplica en modo "participaciones" (Acciones/ETF/Cripto); la
  // obligatoriedad >0 se valida en el formulario segun el tipo.
  participaciones: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  // Modo participaciones: PRECIO POR UNIDAD en la compra (igual que al aportar).
  // Modo dinero: ignorado; el coste viene de `importeInvertido`.
  precioUnitario: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo")
    .optional(),
  // Modo participaciones: comision opcional de la compra inicial (suma al coste).
  // Modo dinero: ignorado.
  comision: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo")
    .optional(),
  // Modo dinero: importe TOTAL gastado en la compra (no por unidad).
  // Modo participaciones: ignorado; el coste = participaciones * precio + comision.
  importeInvertido: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  // Valor TOTAL actual de la posicion (lo que tienes ahora, no por unidad). El
  // precio por unidad se deriva = valorActual / participaciones.
  valorActual: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  // Solo fondos "por dinero": participaciones REALES del usuario para valorar
  // por VL (valor = unidades * VL). Opcional.
  unidadesCotizacion: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo")
    .nullable()
    .optional(),
  moneda: z.string().min(2).max(4),
  // Requerida al CREAR (la cuenta de origen de la que sale el dinero). Al
  // editar puede faltar en inversiones antiguas, asi que la validacion de
  // obligatoriedad se hace en el formulario solo en modo creacion.
  cuentaId: z.string().nullable().optional(),
  fechaCompra: z.date().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
  // Lote 16: TAE automatica (solo "Cuenta remunerada"). 0 o null = sin interes.
  tasaInteres: z
    .number({ message: "Debe ser un numero" })
    .min(0, "No puede ser negativo")
    .nullable()
    .optional(),
  frecuenciaInteres: z
    .enum(["mensual", "trimestral", "anual"])
    .nullable()
    .optional(),
  interesCompuesto: z.boolean().nullable().optional(),
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

// ============================================================================
//  HIPOTECA
// ============================================================================

export const TIPOS_HIPOTECA = ["Fija", "Variable", "Mixta"] as const;

/**
 * Schema del formulario de hipoteca alineado con la tabla `mortgage`:
 *  - precioVivienda, entrada, gastosAsociados (los tres definen el capital)
 *  - plazoAnios, tin, tipo
 *  - tipo Variable/Mixta: diferencial + tipoReferencia
 *  - tipo Mixta: aniosTipoFijo
 *  - fechaInicio: OBLIGATORIO (schema lo tiene NOT NULL)
 */
export const mortgageFormSchema = z.object({
  activa: z.boolean(),
  precioVivienda: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  entrada: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativa"),
  gastosAsociados: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No pueden ser negativos"),
  plazoAnios: z
    .number({ message: "Debe ser un numero" })
    .int()
    .positive("Plazo debe ser positivo")
    .max(50, "Maximo 50 anios"),
  tin: z
    .number({ message: "Debe ser un numero" })
    .min(0, "No puede ser negativo")
    .max(0.3, "TIN demasiado alto (max 30%)"),
  tipo: z.enum(TIPOS_HIPOTECA, { message: "Selecciona un tipo" }),
  diferencial: z
    .number({ message: "Debe ser un numero" })
    .min(0)
    .max(0.1)
    .default(0),
  tipoReferencia: z
    .number({ message: "Debe ser un numero" })
    .min(0)
    .max(0.3)
    .default(0),
  aniosTipoFijo: z
    .number({ message: "Debe ser un numero" })
    .int()
    .min(0)
    .max(50)
    .default(0),
  moneda: z.string().min(2).max(4),
  cuentaPagoId: z.string().nullable().optional(),
  fechaInicio: z.date({ message: "Fecha de inicio obligatoria" }),
  notas: z.string().max(500).nullable().optional(),
});

export type MortgageFormData = z.infer<typeof mortgageFormSchema>;

// ============================================================================
//  OTRAS DEUDAS
// ============================================================================

export const TIPOS_DEUDA = [
  "Prestamo personal",
  "Prestamo coche",
  "Prestamo estudios",
  "Tarjeta credito",
  "Familiar",
  "Otro",
] as const;

/**
 * Schema del formulario de otras deudas alineado con la tabla `otherDebts`:
 *  - concepto, tipo
 *  - importeInicial, capitalPendiente
 *  - tin, plazoRestanteMeses
 *  - moneda, fechaInicio (opcional)
 */
export const otherDebtFormSchema = z.object({
  concepto: z.string().min(1, "El concepto es obligatorio").max(80),
  tipo: z.string().min(1, "Selecciona un tipo").max(40),
  importeInicial: z
    .number({ message: "Debe ser un numero" })
    .positive("Debe ser positivo"),
  capitalPendiente: z
    .number({ message: "Debe ser un numero" })
    .nonnegative("No puede ser negativo"),
  tin: z
    .number({ message: "Debe ser un numero" })
    .min(0, "No puede ser negativo")
    .max(0.5, "TIN demasiado alto (max 50%)"),
  plazoRestanteMeses: z
    .number({ message: "Debe ser un numero" })
    .int()
    .nonnegative("No puede ser negativo"),
  moneda: z.string().min(2).max(4),
  cuentaPagoId: z.string().nullable().optional(),
  fechaInicio: z.date().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
});

export type OtherDebtFormData = z.infer<typeof otherDebtFormSchema>;

const baseMovementShape = {
  fecha: z.date({ message: "Fecha obligatoria" }),
  concepto: z.string().min(1, "El concepto es obligatorio").max(200),
  importe: z
    .number({ message: "Debe ser un numero" })
    .positive("El importe debe ser positivo"),
  moneda: z.string().min(2).max(4),
  notas: z.string().max(500).nullable().optional(),
  // Etiquetas: texto crudo separado por comas (se normaliza al guardar).
  etiquetas: z.string().max(200).nullable().optional(),
};

/**
 * GASTO: requiere cuentaOrigen y categoriaId.
 */
export const gastoFormSchema = z.object({
  ...baseMovementShape,
  cuentaOrigenId: z.string().min(1, "Selecciona una cuenta"),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
});
export type GastoFormData = z.infer<typeof gastoFormSchema>;

/**
 * INGRESO: cuentaDestino opcional (puede ser ingreso sin asignar a cuenta).
 * categoriaTexto libre con sugerencias.
 */
export const ingresoFormSchema = z.object({
  ...baseMovementShape,
  cuentaDestinoId: z.string().nullable().optional(),
  categoriaTexto: z.string().min(1, "Indica o elige una categoria").max(40),
});
export type IngresoFormData = z.infer<typeof ingresoFormSchema>;

/**
 * TRANSFERENCIA: requiere ambas cuentas, distintas.
 */
export const transferenciaFormSchema = z
  .object({
    ...baseMovementShape,
    cuentaOrigenId: z.string().min(1, "Selecciona cuenta origen"),
    cuentaDestinoId: z.string().min(1, "Selecciona cuenta destino"),
    // Solo cuando origen y destino tienen DISTINTA divisa: tipo de cambio
    // (unidades de la moneda destino por 1 de la origen). Editable; por
    // defecto el actual. No se guarda tal cual: al enviar se convierte en
    // `importeDestino`. Ver MovementFormDialog / domain/accounts.ts.
    tipoCambio: z
      .number({ message: "Debe ser un numero" })
      .positive("El tipo de cambio debe ser positivo")
      .optional(),
  })
  .refine((d) => d.cuentaOrigenId !== d.cuentaDestinoId, {
    message: "Las cuentas origen y destino deben ser distintas",
    path: ["cuentaDestinoId"],
  });
export type TransferenciaFormData = z.infer<typeof transferenciaFormSchema>;

/**
 * AJUSTE: requiere cuenta destino o origen. Lo modelamos como:
 *   - "ajuste positivo" (la cuenta tenia mas dinero del calculado) → cuentaDestino
 *   - "ajuste negativo" (tenia menos del calculado) → cuentaOrigen
 *
 * En 10a, el formulario de ajuste manual aun no es protagonista. Lo
 * implementamos en 10b junto con la conciliacion. Pero dejamos el schema
 * preparado para que el repo lo entienda.
 */
export const ajusteFormSchema = z
  .object({
    ...baseMovementShape,
    cuentaOrigenId: z.string().nullable().optional(),
    cuentaDestinoId: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      (d.cuentaOrigenId && !d.cuentaDestinoId) ||
      (!d.cuentaOrigenId && d.cuentaDestinoId),
    {
      message: "El ajuste debe indicar UNA cuenta (origen o destino)",
      path: ["cuentaDestinoId"],
    },
  );
export type AjusteFormData = z.infer<typeof ajusteFormSchema>;
