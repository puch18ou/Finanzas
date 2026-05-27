"use client";

/**
 * src/hooks/useMonthlyIncomes.ts
 *
 * Hook para ingresos mensuales por año. Patron diferente al resto:
 *
 *  - Una sola query por año: useQuery(['monthly-incomes', anio])
 *  - Una sola mutation: upsertByPeriod (no hay create/update por separado)
 *  - ensureYearExists al cargar la pagina garantiza las 12 filas
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { MonthlyIncomeFields } from "@/lib/repositories";

export function useMonthlyIncomes(anio: number, monedaPorDefecto: string) {
  const repos = useRepos();
  const qc = useQueryClient();

  // Query: garantiza primero que existen las 12 filas, luego las devuelve.
  // El "ensure" tambien se ejecuta cuando cambia el año (otra queryKey).
  const query = useQuery({
    queryKey: ["monthly-incomes", anio],
    queryFn: () => repos.monthlyIncomes.ensureYearExists(anio, monedaPorDefecto),
  });

  const upsertMutation = useMutation({
    mutationFn: (args: {
      mes: number;
      fields: MonthlyIncomeFields & { moneda: string };
    }) => repos.monthlyIncomes.upsertByPeriod(anio, args.mes, args.fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-incomes", anio] });
      toast.success("Ingreso mensual actualizado");
    },
    onError: (e) => {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsert: upsertMutation.mutateAsync,
    isMutating: upsertMutation.isPending,
  };
}
