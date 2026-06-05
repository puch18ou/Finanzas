"use client";

/**
 * src/hooks/useObjetivoTramos.ts — tramos del objetivo de ahorro (vigencias).
 * Mismo patron que useGoals: query + create/update/remove con invalidacion.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateObjetivoAhorroTramoData,
  UpdateObjetivoAhorroTramoData,
} from "@/lib/repositories";

export const OBJETIVO_TRAMOS_KEY = ["objetivoTramos"] as const;

export function useObjetivoTramos() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: OBJETIVO_TRAMOS_KEY,
    queryFn: () => repos.objetivoTramos.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateObjetivoAhorroTramoData) =>
      repos.objetivoTramos.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OBJETIVO_TRAMOS_KEY });
      toast.success("Tramo de objetivo creado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateObjetivoAhorroTramoData }) =>
      repos.objetivoTramos.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OBJETIVO_TRAMOS_KEY });
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.objetivoTramos.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OBJETIVO_TRAMOS_KEY });
      toast.success("Tramo eliminado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    tramos: query.data ?? [],
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
