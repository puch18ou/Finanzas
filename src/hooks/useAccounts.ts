"use client";

/**
 * ============================================================================
 *  src/hooks/useAccounts.ts
 * ============================================================================
 *
 *  Mismo patron que useCategories. Para cuentas usamos `listAll()` por
 *  defecto (incluye activas e inactivas) en la pantalla de gestion;
 *  cuando otros lotes necesiten solo activas para selectores, anadiremos
 *  un hook adicional o un parametro.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateAccountData,
  UpdateAccountData,
} from "@/lib/repositories";

export const ACCOUNTS_KEY = ["accounts"] as const;

export function useAccounts() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ACCOUNTS_KEY,
    // listAll() = activas + inactivas no borradas (para la pantalla CRUD)
    queryFn: () => repos.accounts.listAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => repos.accounts.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      toast.success("Cuenta creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateAccountData }) =>
      repos.accounts.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      toast.success("Cuenta actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.accounts.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      toast.success("Cuenta movida a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    accounts: query.data ?? [],
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
