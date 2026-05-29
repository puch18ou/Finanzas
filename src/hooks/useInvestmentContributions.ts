"use client";

/**
 * src/hooks/useInvestmentContributions.ts
 *
 * Aportaciones de una inversion. `add`/`remove` pasan por el servicio (que crea
 * o borra el movimiento de salida y recalcula los totales de la inversion), por
 * eso invalidan tambien investments, accounts y movements.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { AddContributionArgs } from "@/lib/repositories";

export const CONTRIBUTIONS_KEY = ["investmentContributions"] as const;

export function useInvestmentContributions(investmentId?: string) {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...CONTRIBUTIONS_KEY, investmentId ?? null],
    queryFn: () =>
      investmentId
        ? repos.investmentContributions.listByInvestment(investmentId)
        : Promise.resolve([]),
    enabled: !!investmentId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: CONTRIBUTIONS_KEY });
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
  };

  const addMutation = useMutation({
    mutationFn: (args: AddContributionArgs) =>
      repos.investmentContributionService.addContribution(args),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(
        `No se pudo aportar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      repos.investmentContributionService.deleteContribution(id),
    onSuccess: () => {
      invalidate();
      toast.success("Aportacion eliminada");
    },
    onError: (e) =>
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  return {
    contributions: query.data ?? [],
    isLoading: query.isLoading,
    add: addMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isMutating: addMutation.isPending || removeMutation.isPending,
  };
}
