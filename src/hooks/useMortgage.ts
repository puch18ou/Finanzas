"use client";

/**
 * src/hooks/useMortgage.ts
 *
 * Hook singleton para la hipoteca.
 * Lote 11c: tras upsert/clear de hipoteca, invoca al MortgageDebtSyncService
 * para mantener su regla recurrente en sincronia.
 *
 * IMPORTANTE: si tu useMortgage actual tiene mas o menos campos en el
 * objeto devuelto, compara con tu version actual y conserva lo propio.
 * Lo CRITICO de este lote es:
 *   - llamar a mortgageDebtSync.onMortgageUpserted(updated) en onSuccess de upsert
 *   - llamar a mortgageDebtSync.onMortgageDeleted(id) en onSuccess de clear
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: MORTGAGE_KEY });
    qc.invalidateQueries({ queryKey: ["recurringRules"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const upsertMutation = useMutation({
    mutationFn: async (data: MortgageData) => {
      const updated = await repos.mortgage.upsert(data);
      // Sincroniza la regla recurrente
      try {
        await repos.mortgageDebtSync.onMortgageUpserted(updated);
      } catch (err) {
        // No bloqueamos la operacion principal. Logueamos y mostramos toast.
        console.error("[useMortgage] error sincronizando regla:", err);
        toast.error(
          "Hipoteca guardada pero hubo un problema sincronizando la regla recurrente",
        );
      }
      return updated;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Hipoteca guardada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo guardar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const existing = await repos.mortgage.get();
      if (!existing) return;
      await repos.mortgage.clear();
      // Soft delete de la regla y sus movements
      try {
        await repos.mortgageDebtSync.onMortgageDeleted(existing.id);
      } catch (err) {
        console.error("[useMortgage] error limpiando regla:", err);
        toast.error(
          "Hipoteca eliminada pero hubo un problema limpiando la regla recurrente",
        );
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Hipoteca eliminada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo eliminar: ${e instanceof Error ? e.message : "error"}`,
      );
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
