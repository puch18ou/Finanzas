"use client";

/**
 * src/hooks/useCategorySuggestion.ts
 *
 * Devuelve una funcion `suggest(concepto)` que propone la categoria mas
 * probable segun como se categorizaron gastos parecidos en el pasado. El
 * historial se carga una vez y se cachea (react-query). Ver
 * domain/category-suggest.
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@/contexts/DatabaseProvider";
import { suggestCategoria } from "@/lib/domain/category-suggest";

export const CATEGORY_SUGGEST_KEY = ["categorySuggestHistory"] as const;

export function useCategorySuggestion() {
  const repos = useRepos();

  const { data: historial = [] } = useQuery({
    queryKey: CATEGORY_SUGGEST_KEY,
    queryFn: () => repos.movements.listCategorizedConceptos(500),
    staleTime: 5 * 60 * 1000,
  });

  return useCallback(
    (concepto: string): string | null => suggestCategoria(concepto, historial),
    [historial],
  );
}
