"use client";

/**
 * src/hooks/useTrash.ts
 *
 * Hook para la papelera unificada.
 *
 * IMPORTANTE — refresco automatico:
 *   Las queries de papelera usan `staleTime: 0` y `refetchOnMount: 'always'`.
 *   Esto significa que cada vez que el componente se monta (= entras a la
 *   pantalla de papelera) se hace una nueva consulta a la BD, en lugar de
 *   servir datos cacheados.
 *
 *   Es lo deseado porque otras pantallas (Gastos, Cuentas, etc.) hacen
 *   soft-delete sin saber que existe la papelera, y por tanto no invalidan
 *   su cache. Si usaramos cache normal, la papelera mostraria datos
 *   obsoletos hasta que cerrases y reabrieras la app (bug detectado en
 *   Lote 9a).
 *
 *   El coste es minimo: cada apertura de la papelera dispara unas pocas
 *   queries de COUNT y SELECT muy ligeras (<100ms total en local).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { TrashItemType } from "@/lib/repositories";

export const TRASH_COUNTS_KEY = ["trash", "counts"] as const;
export const TRASH_LIST_KEY = (type: TrashItemType) =>
  ["trash", "list", type] as const;

export function useTrashCounts() {
  const repos = useRepos();
  return useQuery({
    queryKey: TRASH_COUNTS_KEY,
    queryFn: () => repos.trash.counts(),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useTrashList(type: TrashItemType) {
  const repos = useRepos();
  return useQuery({
    queryKey: TRASH_LIST_KEY(type),
    queryFn: () => repos.trash.listByType(type),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useTrashActions() {
  const repos = useRepos();
  const qc = useQueryClient();

  // Al restaurar/borrar definitivamente, refrescamos TODO:
  // - Las listas de papelera
  // - Las listas activas (un restore las afecta)
  const invalidateAll = () => {
    qc.invalidateQueries(); // invalida todas las queries
  };

  const restore = useMutation({
    mutationFn: (args: { type: TrashItemType; id: string }) =>
      repos.trash.restore(args.type, args.id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Elemento restaurado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo restaurar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const hardDelete = useMutation({
    mutationFn: (args: { type: TrashItemType; id: string }) =>
      repos.trash.hardDelete(args.type, args.id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Eliminado definitivamente");
    },
    onError: (e) => {
      toast.error(
        `No se pudo eliminar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const emptyAll = useMutation({
    mutationFn: () => repos.trash.emptyAll(),
    onSuccess: () => {
      invalidateAll();
      toast.success("Papelera vaciada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo vaciar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    restore: restore.mutateAsync,
    hardDelete: hardDelete.mutateAsync,
    emptyAll: emptyAll.mutateAsync,
    isMutating: restore.isPending || hardDelete.isPending || emptyAll.isPending,
  };
}
