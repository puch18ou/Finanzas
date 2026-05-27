"use client";

/**
 * src/hooks/useOtherDebts.ts
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

  const createMutation = useMutation({
    mutationFn: (data: CreateOtherDebtData) => repos.otherDebts.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OTHER_DEBTS_KEY });
      toast.success("Deuda creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateOtherDebtData }) =>
      repos.otherDebts.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OTHER_DEBTS_KEY });
      toast.success("Deuda actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.otherDebts.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OTHER_DEBTS_KEY });
      toast.success("Deuda movida a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
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
