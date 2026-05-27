"use client";

/**
 * src/hooks/useRecurringRules.ts — Lote 11a
 *
 * Hook de TanStack Query para reglas recurrentes. Aun no se usa en
 * ninguna pantalla (eso es 11b), pero lo generamos ya para tenerlo listo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateRecurringRuleData,
  UpdateRecurringRuleData,
} from "@/lib/repositories";

export const RECURRING_RULES_KEY = ["recurringRules"] as const;
export const RECURRING_RULES_ACTIVE_KEY = ["recurringRules", "active"] as const;

export function useRecurringRules() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: RECURRING_RULES_KEY,
    queryFn: () => repos.recurringRules.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recurringRules"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateRecurringRuleData) =>
      repos.recurringRules.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("Regla creada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateRecurringRuleData }) =>
      repos.recurringRules.update(args.id, args.patch),
    onSuccess: () => {
      invalidate();
      toast.success("Regla actualizada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.recurringRules.softDelete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Regla movida a la papelera");
    },
    onError: (e) => {
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    rules: query.data ?? [],
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

export function useActiveRecurringRules() {
  const repos = useRepos();
  return useQuery({
    queryKey: RECURRING_RULES_ACTIVE_KEY,
    queryFn: () => repos.recurringRules.listActive(),
  });
}
