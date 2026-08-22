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
import { fetchFxRates } from "@/lib/services/fx-service";
import type {
  CreateCurrencyData,
  UpdateCurrencyData,
} from "@/lib/repositories";

export const CURRENCIES_ALL_KEY = ["currencies", "all"] as const;
// Prefijo compartido con ["currencies"]: al invalidar se refresca tambien.
export const CURRENCIES_USAGE_KEY = ["currencies", "usage"] as const;

/**
 * Codigos de moneda EN USO (referenciados por cualquier tabla o por ajustes).
 * La UI lo usa para impedir el borrado (solo permitir editar).
 */
export function useCurrenciesUsage() {
  const repos = useRepos();
  const query = useQuery({
    queryKey: CURRENCIES_USAGE_KEY,
    queryFn: () => repos.usage.currenciesInUse(),
  });
  return {
    inUse: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
  };
}

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

  // Actualiza tipoCambioVista de todas las monedas desde el proveedor FX,
  // referenciadas a la moneda vista. La moneda vista queda en 1. Sin toasts:
  // los gestiona quien llama (el boton muestra resumen; el auto es silencioso).
  // Devuelve cuantas se actualizaron y cuales no cubre el proveedor.
  const refreshRatesMutation = useMutation({
    mutationFn: async ({ viewCurrency }: { viewCurrency: string }) => {
      const all = await repos.currencies.listAll();
      const symbols = all.map((c) => c.code).filter((c) => c !== viewCurrency);
      const rates = await fetchFxRates(viewCurrency, symbols);

      let actualizadas = 0;
      const noCubiertas: string[] = [];
      // Mapa de tipos YA actualizado, para usarlo al instante (p.ej. al cotizar
      // un activo en otra moneda) sin esperar al refetch de react-query.
      const ratesMap: Record<string, number> = {};
      for (const c of all) {
        if (c.code === viewCurrency) {
          // La moneda vista siempre vale 1 respecto a si misma.
          if (c.tipoCambioVista !== 1) {
            await repos.currencies.update(c.code, { tipoCambioVista: 1 });
          }
          ratesMap[c.code] = 1;
          continue;
        }
        const r = rates[c.code];
        if (typeof r === "number" && Number.isFinite(r) && r > 0) {
          // r = unidades de c por 1 vista  ->  tipoCambioVista = vista por 1 c
          const tcv = 1 / r;
          await repos.currencies.update(c.code, { tipoCambioVista: tcv });
          ratesMap[c.code] = tcv;
          actualizadas++;
        } else {
          noCubiertas.push(c.code);
          ratesMap[c.code] = c.tipoCambioVista; // sin cobertura: dejamos el actual
        }
      }
      return { actualizadas, noCubiertas, ratesMap };
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    // Red de seguridad: aunque la UI deshabilita el boton, revalidamos que la
    // moneda no este en uso antes del borrado FISICO.
    mutationFn: async (code: string) => {
      const inUse = await repos.usage.currenciesInUse();
      if (inUse.has(code)) {
        throw new Error("esta moneda esta en uso");
      }
      return repos.currencies.delete(code);
    },
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
    refreshRates: refreshRatesMutation.mutateAsync,
    isRefreshingRates: refreshRatesMutation.isPending,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}
