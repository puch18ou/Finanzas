"use client";

/**
 * ============================================================================
 *  src/hooks/useCategories.ts
 * ============================================================================
 *
 *  Hook completo para gestionar categorias. Encapsula:
 *
 *    QUERY      → useQuery(['categories'])     listado en cache
 *    MUTATIONS  → create, update, softDelete
 *
 *  Patron: tras cada mutation exitosa, invalidamos la queryKey ['categories']
 *  para que el listado se refresque automaticamente. Toda pantalla que use
 *  este hook ve los cambios sin tener que hacer nada extra.
 *
 *  Los toasts (Sonner) se disparan en las propias mutations para feedback
 *  inmediato. La pagina no tiene que ocuparse de eso.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateCategoryData,
  UpdateCategoryData,
} from "@/lib/repositories";

export const CATEGORIES_KEY = ["categories"] as const;
// Prefijo compartido con CATEGORIES_KEY: al invalidar ["categories"] tambien se
// refresca el uso (react-query casa por prefijo).
export const CATEGORIES_USAGE_KEY = ["categories", "usage"] as const;

/**
 * Ids de categorias EN USO (con movimientos/reglas vivas o categoria de
 * hipoteca). La UI lo usa para impedir el borrado (solo permitir editar).
 */
export function useCategoriesUsage() {
  const repos = useRepos();
  const query = useQuery({
    queryKey: CATEGORIES_USAGE_KEY,
    queryFn: () => repos.usage.categoriesInUse(),
  });
  return {
    inUse: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
  };
}

export function useCategories() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => repos.categories.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryData) => repos.categories.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast.success("Categoria creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateCategoryData }) =>
      repos.categories.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast.success("Categoria actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    // Red de seguridad: aunque la UI deshabilita el boton, revalidamos que la
    // categoria no este en uso antes de borrar.
    mutationFn: async (id: string) => {
      const inUse = await repos.usage.categoriesInUse();
      if (inUse.has(id)) {
        throw new Error(
          "La categoria esta en uso (tiene movimientos o reglas). Solo se puede editar.",
        );
      }
      return repos.categories.softDelete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      toast.success("Categoria movida a la papelera");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => repos.categories.reorder(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (e) => {
      toast.error(
        `No se pudo reordenar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    reorder: reorderMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      reorderMutation.isPending,
  };
}
