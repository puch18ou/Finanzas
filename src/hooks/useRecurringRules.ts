"use client";

/**
 * src/hooks/useRecurringRules.ts — Lote 11a
 *
 * Hook de TanStack Query para reglas recurrentes. Aun no se usa en
 * ninguna pantalla (eso es 11b), pero lo generamos ya para tenerlo listo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  CreateRecurringRuleData,
  UpdateRecurringRuleData,
} from "@/lib/repositories";

export const RECURRING_RULES_KEY = ["recurringRules"] as const;
export const RECURRING_RULES_ACTIVE_KEY = ["recurringRules", "active"] as const;

export function useRecurringRules() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: RECURRING_RULES_KEY,
    queryFn: () => repos.recurringRules.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recurringRules"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["trash"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateRecurringRuleData) => {
      const created = await repos.recurringRules.create(data);
      // Genera ya los movimientos pendientes (p. ej. una regla con inicio en
      // enero creada en junio backfillea enero..mayo). Idempotente; las
      // ocurrencias futuras del mes en curso quedan como "previstos".
      await repos.recurringService.generatePendingUpToCurrentMonth();
      return created;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Regla creada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo crear: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; patch: UpdateRecurringRuleData }) => {
      const updated = await repos.recurringRules.update(args.id, args.patch);
      // Si el rango [fechaInicio, fechaFin] se ha estrechado, limpiamos los
      // movements ya generados que ahora queden fuera (huerfanos).
      await repos.recurringService.softDeleteMovementsOutsideRange(updated);
      // Si se ha ampliado hacia atras (p. ej. fechaInicio a un mes anterior),
      // generamos los movimientos que ahora caen dentro del rango.
      await repos.recurringService.generatePendingUpToCurrentMonth();
      return updated;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Regla actualizada");
    },
    onError: (e) => {
      toast.error(
        `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repos.recurringRules.softDelete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Regla movida a la papelera");
    },
    onError: (e) => {
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    rules: query.data ?? [],
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

export function useActiveRecurringRules() {
  const repos = useRepos();
  return useQuery({
    queryKey: RECURRING_RULES_ACTIVE_KEY,
    queryFn: () => repos.recurringRules.listActive(),
  });
}
