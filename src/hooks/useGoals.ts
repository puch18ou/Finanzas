"use client";

/**
 * src/hooks/useGoals.ts
 *
 * Mismo patron CRUD.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { CreateGoalData, UpdateGoalData } from "@/lib/repositories";

export const GOALS_KEY = ["goals"] as const;

export function useGoals() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: GOALS_KEY,
    queryFn: () => repos.goals.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGoalData) => repos.goals.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
      toast.success("Meta creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateGoalData }) =>
      repos.goals.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
      toast.success("Meta actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.goals.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
      toast.success("Meta movida a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    goals: query.data ?? [],
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
