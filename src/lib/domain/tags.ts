/**
 * ============================================================================
 *  src/lib/domain/tags.ts — Etiquetas (tags) de movimientos
 * ============================================================================
 *
 *  Las etiquetas son una segunda dimension transversal ADEMAS de la categoria:
 *  un movimiento tiene 1 categoria pero N etiquetas (ej "viaje-japon"). Permiten
 *  cruzar gastos de varias categorias ("¿cuanto me costo el viaje a Japon?").
 *
 *  Se guardan en una sola columna TEXT `movements.etiquetas` como lista
 *  separada por comas, NORMALIZADA (minusculas, sin espacios extra, sin
 *  duplicados). Estas funciones encapsulan ese (de)serializado.
 * ============================================================================
 */

/** Normaliza una etiqueta suelta: minusculas, espacios colapsados, trim. */
function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Parsea la columna a una lista de etiquetas normalizadas y sin duplicados. */
export function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const t = normalizeTag(part);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Serializa a la columna (lista separada por comas) o null si no hay ninguna.
 * Acepta el texto crudo del input o una lista ya hecha.
 */
export function serializeTags(
  value: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(value) ? value.join(",") : value;
  const tags = parseTags(raw);
  return tags.length > 0 ? tags.join(",") : null;
}

/** ¿El movimiento (su columna etiquetas) tiene la etiqueta dada? */
export function hasTag(
  etiquetas: string | null | undefined,
  tag: string,
): boolean {
  return parseTags(etiquetas).includes(normalizeTag(tag));
}

/** Conjunto ordenado de todas las etiquetas presentes en una lista de movs. */
export function allTags(
  movimientos: Array<{ etiquetas?: string | null }>,
): string[] {
  const set = new Set<string>();
  for (const m of movimientos) {
    for (const t of parseTags(m.etiquetas)) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
