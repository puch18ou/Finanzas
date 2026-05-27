"use client";

/**
 * src/hooks/useExtraIncomes.ts
 *
 * Hook de ingresos puntuales. Mismo patron que useExpenses.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateExtraIncomeData,
  UpdateExtraIncomeData,
  ExtraIncomeFilter,
} from "@/lib/repositories";

const EXTRA_INCOMES_BASE_KEY = "extra-incomes";

function extraIncomesKey(filter: ExtraIncomeFilter) {
  return [EXTRA_INCOMES_BASE_KEY, filter] as const;
}

export function useExtraIncomes(filter: ExtraIncomeFilter = {}) {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: extraIncomesKey(filter),
    queryFn: () => repos.extraIncomes.list(filter),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: [EXTRA_INCOMES_BASE_KEY] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateExtraIncomeData) => repos.extraIncomes.create(data),
    onSuccess: () => {
      invalidateAll();
      toast.success("Ingreso puntual registrado");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateExtraIncomeData }) =>
      repos.extraIncomes.update(args.id, args.patch),
    onSuccess: () => {
      invalidateAll();
      toast.success("Ingreso actualizado");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.extraIncomes.softDelete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Ingreso movido a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    extras: query.data ?? [],
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
