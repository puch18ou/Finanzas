"use client";

/**
 * src/hooks/useMovements.ts — sin cambios funcionales respecto a 10a-1.
 * Lo incluyo en el pack por completitud y para evitar confusion.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateMovementData,
  UpdateMovementData,
  MovementFilter,
} from "@/lib/repositories";

export const MOVEMENTS_KEY = (filter: MovementFilter = {}) =>
  ["movements", filter] as const;

export function useMovements(filter: MovementFilter = {}) {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: MOVEMENTS_KEY(filter),
    queryFn: () => repos.movements.list(filter),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateMovementData) => repos.movements.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("Movimiento creado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateMovementData }) =>
      repos.movements.update(args.id, args.patch),
    onSuccess: () => {
      invalidate();
      toast.success("Movimiento actualizado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.movements.softDelete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Movimiento movido a la papelera");
    },
    onError: (e) => {
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    movements: query.data ?? [],
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
