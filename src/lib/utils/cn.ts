/**
 * cn — utilidad para combinar clases de Tailwind con resolucion inteligente
 * de conflictos.
 *
 * `clsx` combina condicionales:
 *   cn("foo", isActive && "bar")  // -> "foo bar" o "foo"
 *
 * `twMerge` resuelve conflictos de Tailwind:
 *   cn("p-4", "p-2")              // -> "p-2"  (no "p-4 p-2")
 *   cn("bg-red-500", "bg-blue-500") // -> "bg-blue-500"
 *
 * Imprescindible para componentes que permiten al consumidor pasar
 * className adicional sin pelearse con las clases base.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
