"use client";

/**
 * src/hooks/useOtherDebts.ts
 *
 * Lote 11c: tras create/update/softDelete de deuda, invoca al
 * MortgageDebtSyncService para mantener su regla recurrente.
 *
 * IMPORTANTE: si tu useOtherDebts actual devuelve un shape distinto,
 * compara y conserva lo tuyo. Lo CRITICO es engancharse en:
 *   - onSuccess de create → onDebtCreated(created)
 *   - onSuccess de update → onDebtUpdated(updated)
 *   - onSuccess de remove → onDebtDeleted(id)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateOtherDebtData,
  UpdateOtherDebtData,
} from "@/lib/repositories";

export const OTHER_DEBTS_KEY = ["otherDebts"] as const;

export function useOtherDebts() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: OTHER_DEBTS_KEY,
    queryFn: () => repos.otherDebts.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: OTHER_DEBTS_KEY });
    qc.invalidateQueries({ queryKey: ["recurringRules"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateOtherDebtData) => {
      const created = await repos.otherDebts.create(data);
      try {
        await repos.mortgageDebtSync.onDebtCreated(created);
      } catch (err) {
        console.error("[useOtherDebts] error sincronizando regla:", err);
        toast.error(
          "Deuda creada pero hubo un problema con la regla recurrente",
        );
      }
      return created;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Deuda creada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; patch: UpdateOtherDebtData }) => {
      const updated = await repos.otherDebts.update(args.id, args.patch);
      try {
        await repos.mortgageDebtSync.onDebtUpdated(updated);
      } catch (err) {
        console.error("[useOtherDebts] error sincronizando regla:", err);
        toast.error(
          "Deuda actualizada pero hubo un problema con la regla recurrente",
        );
      }
      return updated;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Deuda actualizada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await repos.otherDebts.softDelete(id);
      try {
        await repos.mortgageDebtSync.onDebtDeleted(id);
      } catch (err) {
        console.error("[useOtherDebts] error limpiando regla:", err);
        toast.error(
          "Deuda eliminada pero hubo un problema con la regla recurrente",
        );
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Deuda movida a la papelera");
    },
    onError: (e) => {
      toast.error(
        `No se pudo eliminar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    debts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}
