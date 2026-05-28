"use client";

/**
 * ============================================================================
 *  src/hooks/useSettings.ts — Hook de acceso a Ajustes
 * ============================================================================
 *
 *  Es el hook MAS USADO de la app: practicamente cada pantalla necesita
 *  saber la moneda local/vista, el mes/anio activos, etc.
 *
 *  Expone:
 *    - settings:  los ajustes actuales (undefined si aun cargando)
 *    - isLoading: true mientras hace la primera carga
 *    - update:    funcion para modificar campos. Devuelve una promesa.
 *
 *  PATRON: query + mutation
 *  ------------------------
 *  TanStack Query distingue dos operaciones:
 *
 *    - QUERY (useQuery): lectura. Cachea por queryKey. Invalidar = forzar
 *      refetch.
 *    - MUTATION (useMutation): escritura. Al exito, invalidamos la query
 *      relacionada para que el siguiente render lea los datos frescos.
 *
 *  Aqui usamos la queryKey ['settings']. Cuando el usuario edita un campo
 *  en la pantalla de Ajustes, la mutation llama al repo, y onSuccess
 *  invalida ['settings'] para que toda la app se entere del cambio.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { SettingsPatch } from "@/lib/repositories";

const SETTINGS_KEY = ["settings"] as const;

export function useSettings() {
  const repos = useRepos();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => repos.settings.get(),
  });

  const mutation = useMutation({
    mutationFn: async (patch: SettingsPatch) => {
      const updated = await repos.settings.update(patch);

      // Lote 10b-3: al fijar/cambiar la cuenta por defecto, asignamos esa
      // cuenta a los movimientos que aun no tienen cuenta (idempotente).
      let backfilled = 0;
      if (
        typeof patch.cuentaPorDefectoId === "string" &&
        patch.cuentaPorDefectoId
      ) {
        backfilled = await repos.movements.backfillMissingAccount(
          patch.cuentaPorDefectoId,
        );
      }
      return { updated, backfilled };
    },
    onSuccess: ({ updated, backfilled }) => {
      // Actualizamos la cache directamente en lugar de invalidar, para
      // evitar un re-fetch innecesario. El componente vera el nuevo valor
      // en el siguiente render.
      queryClient.setQueryData(SETTINGS_KEY, updated);

      if (backfilled > 0) {
        // Cambiaron movimientos → refrescar listas y saldos calculados.
        queryClient.invalidateQueries({ queryKey: ["movements"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        toast.success(
          `${backfilled} movimiento${backfilled === 1 ? "" : "s"} sin cuenta ${
            backfilled === 1 ? "asignado" : "asignados"
          } a la cuenta por defecto`,
        );
      }
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

/**
 * Hook auxiliar para listar monedas activas. Lo usa la pantalla de Ajustes
 * para poblar los <Select> de moneda local y vista.
 */
export function useCurrencies() {
  const repos = useRepos();

  return useQuery({
    queryKey: ["currencies", "active"],
    queryFn: () => repos.currencies.listActive(),
  });
}
