/**
 * src/lib/schemas/forms-recurring.ts
 *
 * Schema Zod para el formulario de regla recurrente.
 *
 * Como las reglas pueden ser de varios tipos (gasto, ingreso, transferencia)
 * y cada uno tiene requisitos distintos, usamos un schema base y validacion
 * cruzada con .refine().
 *
 * Reglas vinculadas (tipo 'cuota' o 'intereses') NO se editan desde aqui:
 * se crean automaticamente al crear/editar la entidad padre. Por eso este
 * schema solo permite 'gasto', 'ingreso', 'transferencia'.
 */

import { z } from "zod";

export const TIPOS_REGLA_MANUAL = ["gasto", "ingreso", "transferencia"] as const;
export type TipoReglaManual = typeof TIPOS_REGLA_MANUAL[number];

export const recurringRuleFormSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es obligatorio").max(100),
    tipoMovimiento: z.enum(TIPOS_REGLA_MANUAL, {
      message: "Tipo invalido",
    }),
    importe: z
      .number({ message: "Debe ser un numero" })
      .positive("El importe debe ser positivo"),
    moneda: z.string().min(2).max(4),
    cuentaOrigenId: z.string().nullable().optional(),
    cuentaDestinoId: z.string().nullable().optional(),
    categoriaId: z.string().nullable().optional(),
    categoriaTexto: z.string().max(40).nullable().optional(),
    diaDelMes: z
      .number({ message: "Debe ser un numero" })
      .int("Debe ser entero")
      .min(1, "Minimo 1")
      .max(31, "Maximo 31"),
    fechaInicio: z.date({ message: "Fecha de inicio obligatoria" }),
    fechaFin: z.date().nullable().optional(),
    activa: z.boolean(),
    notas: z.string().max(500).nullable().optional(),
  })
  .refine(
    (d) => {
      // Validacion: gasto requiere cuentaOrigen y categoriaId
      if (d.tipoMovimiento === "gasto") {
        return !!d.cuentaOrigenId && !!d.categoriaId;
      }
      return true;
    },
    {
      message: "Un gasto requiere cuenta origen y categoria",
      path: ["cuentaOrigenId"],
    },
  )
  .refine(
    (d) => {
      // Validacion: ingreso requiere categoriaTexto (cuentaDestino opcional)
      if (d.tipoMovimiento === "ingreso") {
        return !!d.categoriaTexto && d.categoriaTexto.length > 0;
      }
      return true;
    },
    {
      message: "Un ingreso requiere categoria (texto libre)",
      path: ["categoriaTexto"],
    },
  )
  .refine(
    (d) => {
      // Validacion: transferencia requiere ambas cuentas y distintas
      if (d.tipoMovimiento === "transferencia") {
        if (!d.cuentaOrigenId || !d.cuentaDestinoId) return false;
        if (d.cuentaOrigenId === d.cuentaDestinoId) return false;
      }
      return true;
    },
    {
      message: "Una transferencia requiere cuentas origen y destino distintas",
      path: ["cuentaDestinoId"],
    },
  )
  .refine(
    (d) => {
      // Validacion: si fechaFin, debe ser >= fechaInicio
      if (d.fechaFin && d.fechaInicio) {
        return d.fechaFin.getTime() >= d.fechaInicio.getTime();
      }
      return true;
    },
    {
      message: "La fecha fin debe ser posterior a la fecha de inicio",
      path: ["fechaFin"],
    },
  );

export type RecurringRuleFormData = z.infer<typeof recurringRuleFormSchema>;
