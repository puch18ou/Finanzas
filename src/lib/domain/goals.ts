/**
 * ============================================================================
 *  src/lib/domain/goals.ts — Calculos sobre metas de ahorro
 * ============================================================================
 *
 *  Para cada meta calculamos:
 *    - Progreso: cuanto se ha ahorrado / objetivo (0..1, en porcentaje)
 *    - Meses restantes: cuantos meses faltan hasta la fecha objetivo
 *    - Ahorro mensual necesario: cuanto hay que aportar cada mes para
 *      llegar al objetivo en la fecha indicada
 *
 *  La meta es trivial pero util tenerla aislada: la pantalla de Metas
 *  mostrara una barra de progreso, un contador de meses, y la cifra
 *  mensual sugerida — todo derivado de estas funciones.
 * ============================================================================
 */

import type { Goal } from "@/lib/db/schema";

export type GoalProgress = {
  /** progreso entre 0 y 1 (clamp). Si yaAhorrado >= objetivo, 1. */
  progreso: number;
  /** lo que falta por ahorrar en moneda original de la meta */
  restante: number;
  /** meses entre hoy y fechaObjetivo (puede ser negativo si pasada) */
  mesesRestantes: number;
  /**
   * Ahorro mensual necesario para cumplir el objetivo a tiempo.
   * Si la fecha ya paso o la meta ya esta cumplida, 0.
   */
  ahorroMensualNecesario: number;
  /** true si la fecha objetivo ya paso y la meta no esta completa */
  vencida: boolean;
  /** true si yaAhorrado >= importeObjetivo */
  completada: boolean;
};

/**
 * Calcula numero entero de meses entre dos fechas. Aproximacion:
 *   diff = (year2-year1)*12 + (month2-month1)
 * Mas dia: si el dia destino es mayor o igual al actual, sumamos 0; si no, restamos 1.
 *
 * Esta aproximacion es suficiente para mostrar "te quedan X meses". No
 * pretende ser un calculo de duracion exacto.
 */
export function monthsBetween(from: Date, to: Date): number {
  // `to` es una fecha civil (fechaObjetivo, guardada a mediodia UTC). Leemos
  // ambos extremos con getUTC* para que el calculo no se desplace al viajar.
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  const days = to.getUTCDate() - from.getUTCDate();

  let total = years * 12 + months;
  if (days < 0) total -= 1;
  return total;
}

/**
 * Calcula el estado de progreso de una meta a fecha actual (o a la fecha
 * de referencia que pasemos, util para tests).
 */
export function calculateGoalProgress(
  goal: Goal,
  referenceDate: Date = new Date(),
): GoalProgress {
  const restanteRaw = goal.importeObjetivo - goal.yaAhorrado;
  const restante = Math.max(0, restanteRaw);

  // Limitamos progreso a [0, 1] aunque yaAhorrado pueda exceder objetivo.
  const progreso = Math.min(
    1,
    goal.yaAhorrado / goal.importeObjetivo,
  );

  const completada = goal.yaAhorrado >= goal.importeObjetivo;
  const fechaObj = goal.fechaObjetivo instanceof Date
    ? goal.fechaObjetivo
    : new Date(goal.fechaObjetivo);

  const mesesRestantes = monthsBetween(referenceDate, fechaObj);
  const vencida = mesesRestantes < 0 && !completada;

  let ahorroMensualNecesario = 0;
  if (!completada && mesesRestantes > 0) {
    ahorroMensualNecesario = restante / mesesRestantes;
  }

  return {
    progreso,
    restante,
    mesesRestantes,
    ahorroMensualNecesario,
    vencida,
    completada,
  };
}
