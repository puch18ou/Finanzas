/**
 * src/components/mobile/movement-display.ts — Clasificacion visual de un
 * movimiento para la UI de movil (signo y color).
 */

export type MovKind = "expense" | "income" | "neutral";

export function movementKind(tipo: string): MovKind {
  if (tipo === "gasto" || tipo === "cuota" || tipo === "intereses") {
    return "expense";
  }
  if (tipo === "ingreso" || tipo === "devolucion") return "income";
  return "neutral"; // transferencia, ajuste
}

export function movKindColor(kind: MovKind): string {
  if (kind === "expense") return "text-red-600 dark:text-red-400";
  if (kind === "income") return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

export function movKindSign(kind: MovKind): string {
  if (kind === "expense") return "-";
  if (kind === "income") return "+";
  return "";
}
