/**
 * src/lib/utils/money.ts — Formateo de importes para la UI.
 */

export function formatMoney(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Moneda no estandar (p. ej. cripto): formato simple.
    return `${amount.toFixed(2)} ${currency}`;
  }
}
