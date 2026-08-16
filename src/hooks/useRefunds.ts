"use client";

/**
 * src/hooks/useRefunds.ts — Devoluciones asociadas a un gasto.
 *
 * Una devolucion es un movimiento tipo 'devolucion' con gastoAsociadoId = id del
 * gasto. useRefunds(gastoId) gestiona las de UN gasto (listar/añadir/quitar);
 * useRefundTotals() da el mapa gastoId->total devuelto para pintar el coste real
 * en las listas. Ver domain/refunds.ts y movement-repository.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { CreateMovementData } from "@/lib/repositories";

/**
 * Mapa gastoId -> devoluciones (importe + moneda) para calcular el coste real
 * en las listas. La suma convertida la hace domain/refunds.sumRefundsInCurrency.
 */
export function useRefundTotals() {
  const repos = useRepos();
  return useQuery({
    queryKey: ["refundTotals"],
    queryFn: () => repos.movements.refundsByGastoMap(),
  });
}

export function useRefunds(gastoId: string | null) {
  const repos = useRepos();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["refunds"] });
    qc.invalidateQueries({ queryKey: ["refundTotals"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const list = useQuery({
    queryKey: ["refunds", gastoId],
    queryFn: () =>
      gastoId ? repos.movements.listByGastoAsociado(gastoId) : Promise.resolve([]),
    enabled: !!gastoId,
  });

  const add = useMutation({
    mutationFn: (data: CreateMovementData) => repos.movements.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("Devolución añadida");
    },
    onError: (e) =>
      toast.error(`No se pudo añadir: ${e instanceof Error ? e.message : "error"}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => repos.movements.softDelete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Devolución quitada");
    },
    onError: (e) =>
      toast.error(`No se pudo quitar: ${e instanceof Error ? e.message : "error"}`),
  });

  return {
    refunds: list.data ?? [],
    isLoading: list.isLoading,
    add: add.mutateAsync,
    remove: remove.mutateAsync,
    isMutating: add.isPending || remove.isPending,
  };
}
