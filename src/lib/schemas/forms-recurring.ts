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

export const FRECUENCIAS_REGLA = [
  "diaria",
  "semanal",
  "mensual",
  "anual",
  "varios-mes",
] as const;
export type FrecuenciaRegla = typeof FRECUENCIAS_REGLA[number];

/**
 * Parsea/valida una lista de dias del mes "1,15,28": enteros 1-31, sin
 * duplicados. Devuelve null si algun token no es valido (para que el refine
 * marque error). Cadena vacia -> [].
 */
export function parseDiasDelMesInput(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(",").map((s) => s.trim());
  const out: number[] = [];
  const seen = new Set<number>();
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (n < 1 || n > 31) return null;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

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
    frecuencia: z.enum(FRECUENCIAS_REGLA, { message: "Frecuencia invalida" }),
    // 0=domingo..6=sabado. Solo relevante en 'semanal'.
    diaSemana: z.number().int().min(0).max(6).nullable().optional(),
    // Lista de dias "1,15". Solo relevante en 'varios-mes'.
    diasDelMes: z.string().max(100).nullable().optional(),
    // Mes 1-12. Solo relevante en 'anual'.
    mesDelAnio: z.number().int().min(1).max(12).nullable().optional(),
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
  )
  .refine(
    (d) => {
      // 'semanal' requiere un dia de la semana valido (0-6).
      if (d.frecuencia === "semanal") {
        return d.diaSemana != null && d.diaSemana >= 0 && d.diaSemana <= 6;
      }
      return true;
    },
    {
      message: "Elige un dia de la semana",
      path: ["diaSemana"],
    },
  )
  .refine(
    (d) => {
      // 'anual' requiere un mes 1-12.
      if (d.frecuencia === "anual") {
        return d.mesDelAnio != null && d.mesDelAnio >= 1 && d.mesDelAnio <= 12;
      }
      return true;
    },
    {
      message: "Elige un mes",
      path: ["mesDelAnio"],
    },
  )
  .refine(
    (d) => {
      // 'varios-mes' requiere una lista valida con al menos un dia.
      if (d.frecuencia === "varios-mes") {
        const parsed = parseDiasDelMesInput(d.diasDelMes ?? "");
        return parsed != null && parsed.length > 0;
      }
      return true;
    },
    {
      message: "Indica dias validos separados por comas (ej. 1,15)",
      path: ["diasDelMes"],
    },
  );

export type RecurringRuleFormData = z.infer<typeof recurringRuleFormSchema>;
