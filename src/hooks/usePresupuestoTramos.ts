"use client";

/**
 * src/hooks/usePresupuestoTramos.ts — tramos de presupuesto por categoria.
 * Devuelve TODOS los tramos activos; los consumidores los agrupan por
 * categoria. Mismo patron CRUD que useObjetivoTramos.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreatePresupuestoTramoData,
  UpdatePresupuestoTramoData,
} from "@/lib/repositories";

export const PRESUPUESTO_TRAMOS_KEY = ["presupuestoTramos"] as const;

export function usePresupuestoTramos() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: PRESUPUESTO_TRAMOS_KEY,
    queryFn: () => repos.presupuestoTramos.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePresupuestoTramoData) =>
      repos.presupuestoTramos.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRESUPUESTO_TRAMOS_KEY });
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdatePresupuestoTramoData }) =>
      repos.presupuestoTramos.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRESUPUESTO_TRAMOS_KEY });
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.presupuestoTramos.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRESUPUESTO_TRAMOS_KEY });
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
