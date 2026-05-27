"use client";

/**
 * ============================================================================
 *  src/hooks/useCurrenciesManagement.ts
 * ============================================================================
 *
 *  Hook para la pantalla de gestion de monedas. Diferencias con
 *  `useCurrencies` (de useSettings.ts):
 *
 *    - Lista TODAS (no solo las activas)
 *    - Expone create/update/delete (no solo lectura)
 *
 *  ATENCION: en monedas el borrado es FISICO, no soft. Razon:
 *    - La PK es el codigo ISO ('EUR', 'USD'...), no UUID
 *    - El catalogo es estable: rara vez borras una moneda
 *    - Si esta en uso (FK desde categories/expenses/etc), el DELETE
 *      fallara con FOREIGN KEY constraint. El hook captura el error y
 *      muestra un toast claro.
 *
 *  Tambien expone una mutation para cambiar la moneda VISTA, que dispara
 *  el recompute de todos los tipos de cambio. Lo usaremos desde Ajustes
 *  en un lote futuro; de momento queda preparado.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateCurrencyData,
  UpdateCurrencyData,
} from "@/lib/repositories";

export const CURRENCIES_ALL_KEY = ["currencies", "all"] as const;

export function useCurrenciesManagement() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: CURRENCIES_ALL_KEY,
    queryFn: () => repos.currencies.listAll(),
  });

  // Funcion auxiliar: invalida tanto la lista 'all' como la 'active' (usada
  // por selectores como en Ajustes). De este modo cualquier cambio se ve
  // en todas las pantallas.
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["currencies"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateCurrencyData) => repos.currencies.create(data),
    onSuccess: () => {
      invalidateAll();
      toast.success("Moneda creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { code: string; patch: UpdateCurrencyData }) =>
      repos.currencies.update(args.code, args.patch),
    onSuccess: () => {
      invalidateAll();
      toast.success("Moneda actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => repos.currencies.delete(code),
    onSuccess: () => {
      invalidateAll();
      toast.success("Moneda eliminada");
    },
    onError: (e) => {
      // Caso comun: FK constraint porque la moneda esta en uso.
      toast.error(
        `No se pudo borrar: ${
          e instanceof Error ? e.message : "esta moneda esta en uso"
        }`,
      );
    },
  });

  return {
    currencies: query.data ?? [],
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
