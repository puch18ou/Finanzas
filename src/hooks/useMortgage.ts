"use client";

/**
 * src/hooks/useMortgage.ts
 *
 * Hook singleton para la hipoteca.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { MortgageData } from "@/lib/repositories";

export const MORTGAGE_KEY = ["mortgage"] as const;

export function useMortgage() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: MORTGAGE_KEY,
    queryFn: () => repos.mortgage.get(),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: MortgageData) => repos.mortgage.upsert(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MORTGAGE_KEY });
      toast.success("Hipoteca guardada");
    },
    onError: (e) => {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => repos.mortgage.clear(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MORTGAGE_KEY });
      toast.success("Hipoteca desactivada");
    },
    onError: (e) => {
      toast.error(`No se pudo desactivar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    mortgage: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    upsert: upsertMutation.mutateAsync,
    clear: clearMutation.mutateAsync,
    isMutating: upsertMutation.isPending || clearMutation.isPending,
  };
}
