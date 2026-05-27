"use client";

/**
 * ============================================================================
 *  src/hooks/useExpenses.ts
 * ============================================================================
 *
 *  Hook de gastos con filtros dinamicos. Acepta un objeto `filter` que
 *  forma parte de la queryKey: al cambiar los filtros, TanStack Query
 *  ejecuta una nueva query (con cache distinta).
 *
 *  Esto da el comportamiento esperado:
 *    - Cambias el mes → la tabla se refresca
 *    - Vuelves al mes anterior → instantaneo (queda en cache)
 *
 *  USO:
 *
 *    const { expenses, isLoading, create, update, remove } = useExpenses({
 *      anio: 2026,
 *      mes: 1,
 *    });
 *
 *  Tambien expone useExpenseCount() para paginacion futura.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilter,
} from "@/lib/repositories";

const EXPENSES_BASE_KEY = "expenses";

/**
 * Construye la queryKey a partir del filtro. La key es serializable y
 * unica por combinacion de filtros.
 */
function expensesKey(filter: ExpenseFilter) {
  return [EXPENSES_BASE_KEY, filter] as const;
}

export function useExpenses(filter: ExpenseFilter = {}) {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: expensesKey(filter),
    queryFn: () => repos.expenses.list(filter),
  });

  // Invalida TODAS las queries de expenses al mutar (sin importar filtros),
  // porque un cambio puede afectar a cualquier filtro activo.
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: [EXPENSES_BASE_KEY] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseData) => repos.expenses.create(data),
    onSuccess: () => {
      invalidateAll();
      toast.success("Gasto registrado");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateExpenseData }) =>
      repos.expenses.update(args.id, args.patch),
    onSuccess: () => {
      invalidateAll();
      toast.success("Gasto actualizado");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.expenses.softDelete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Gasto movido a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    expenses: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
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
