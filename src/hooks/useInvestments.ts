"use client";

/**
 * src/hooks/useInvestments.ts
 *
 * Mismo patron que el resto de hooks CRUD. Expone updatePrice() ademas
 * de los update/create/delete habituales.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateInvestmentData,
  UpdateInvestmentData,
} from "@/lib/repositories";

export const INVESTMENTS_KEY = ["investments"] as const;

export function useInvestments() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: INVESTMENTS_KEY,
    queryFn: () => repos.investments.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInvestmentData) => repos.investments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      toast.success("Inversion creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateInvestmentData }) =>
      repos.investments.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      toast.success("Inversion actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: (args: { id: string; precio: number }) =>
      repos.investments.updatePrice(args.id, args.precio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      // Toast mas discreto para no saturar (edicion inline)
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar el precio: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.investments.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      toast.success("Inversion movida a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    investments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    updatePrice: updatePriceMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      updatePriceMutation.isPending ||
      deleteMutation.isPending,
  };
}
