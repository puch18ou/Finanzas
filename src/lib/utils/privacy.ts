/**
 * src/lib/utils/privacy.ts — Enmascarado de importes para el modo privacidad.
 */

export const MONEY_MASK = "••••";

/**
 * Sustituye la parte NUMERICA de un importe ya formateado por la mascara,
 * conservando el simbolo/codigo de moneda y su posicion. Ejemplos:
 *   "1.234,56 €"  -> "•••• €"
 *   "S$ 1,234.56" -> "S$ ••••"
 *   "-45,00 €"    -> "-•••• €"
 */
export function maskMoney(formatted: string): string {
  return formatted.replace(/\d[\d.,]*/g, MONEY_MASK);
}
