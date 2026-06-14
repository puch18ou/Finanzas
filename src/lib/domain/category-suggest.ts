/**
 * ============================================================================
 *  src/lib/domain/category-suggest.ts — Sugerencia de categoria por concepto
 * ============================================================================
 *
 *  Pre-rellena la categoria de un gasto a partir del CONCEPTO que escribe el
 *  usuario, mirando como categorizo gastos parecidos en el pasado. SIN IA: es
 *  comparacion de texto (tokens) + frecuencia. Es solo una sugerencia: el
 *  usuario puede cambiarla siempre.
 *
 *  Idea: "si pones MERCADONA y siempre lo categorizas como Supermercado, te lo
 *  rellena solo".
 * ============================================================================
 */

/** Pasa a minusculas, quita acentos y normaliza espacios. */
export function normalizeConcepto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacriticos (marcas combinantes)
    .replace(/[^a-z0-9\s]/g, " ") // signos -> espacio
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significativos (>= 3 caracteres) del concepto normalizado. */
function tokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length >= 3);
}

export type ConceptoHistorial = {
  concepto: string;
  categoriaId: string;
};

/**
 * Sugiere la categoria mas probable para `concepto` segun el historial (pares
 * concepto->categoria de gastos pasados, idealmente recientes primero).
 *
 * Puntuacion por fila del historial:
 *   - concepto normalizado IDENTICO          -> +100
 *   - uno contiene al otro (substring)        -> +5
 *   - por cada token significativo compartido -> +10
 * Se suma por categoria; gana la de mayor puntuacion. Empate -> la que aparece
 * antes (mas reciente). Devuelve null si no hay ninguna coincidencia.
 */
export function suggestCategoria(
  concepto: string,
  historial: ConceptoHistorial[],
): string | null {
  const norm = normalizeConcepto(concepto);
  if (norm.length < 3) return null;
  const toks = new Set(tokens(norm));
  if (toks.size === 0) return null;

  const score = new Map<string, number>();
  // Para desempatar por recencia: recordamos el primer indice donde una
  // categoria alcanzo su mejor aparicion.
  const firstSeen = new Map<string, number>();

  historial.forEach((row, idx) => {
    if (!row.categoriaId) return;
    const hNorm = normalizeConcepto(row.concepto);
    if (!hNorm) return;

    let s = 0;
    if (hNorm === norm) s += 100;
    if (hNorm.includes(norm) || norm.includes(hNorm)) s += 5;
    for (const t of tokens(hNorm)) {
      if (toks.has(t)) s += 10;
    }
    if (s <= 0) return;

    score.set(row.categoriaId, (score.get(row.categoriaId) ?? 0) + s);
    if (!firstSeen.has(row.categoriaId)) firstSeen.set(row.categoriaId, idx);
  });

  let best: string | null = null;
  let bestScore = 0;
  let bestIdx = Infinity;
  for (const [cat, s] of score) {
    const idx = firstSeen.get(cat) ?? Infinity;
    if (s > bestScore || (s === bestScore && idx < bestIdx)) {
      best = cat;
      bestScore = s;
      bestIdx = idx;
    }
  }
  return best;
}
