"use client";

/**
 * src/hooks/useInvestmentContributions.ts
 *
 * Aportaciones de una inversion. `add`/`remove` pasan por el servicio (que crea
 * o borra el movimiento de salida y recalcula los totales de la inversion), por
 * eso invalidan tambien investments, accounts y movements.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type {
  AddContributionArgs,
  WithdrawArgs,
  UpdateContributionArgs,
  CreateInvestmentData,
} from "@/lib/repositories";

export const CONTRIBUTIONS_KEY = ["investmentContributions"] as const;
export const INVESTMENT_PLAN_KEY = ["investmentPlan"] as const;

/** Datos de un plan de aportacion periodica (Lote 13b-2). */
export type SavePlanArgs = {
  /** Si se indica, edita ese plan; si no, crea uno nuevo. */
  id?: string;
  /** Nombre y moneda de la inversion (para construir la regla). */
  nombre: string;
  moneda: string;
  importe: number;
  cuentaOrigenId: string;
  frecuencia: "diaria" | "semanal" | "mensual";
  /** Solo para 'mensual' (1-31). En otras frecuencias se ignora. */
  diaDelMes: number;
  /** Solo para 'semanal' (0=domingo..6=sabado). */
  diaSemana: number | null;
  fechaInicio: Date;
  fechaFin: Date | null;
};

export function useInvestmentContributions(investmentId?: string) {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...CONTRIBUTIONS_KEY, investmentId ?? null],
    queryFn: () =>
      investmentId
        ? repos.investmentContributions.listByInvestment(investmentId)
        : Promise.resolve([]),
    enabled: !!investmentId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: CONTRIBUTIONS_KEY });
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
  };

  const addMutation = useMutation({
    mutationFn: (args: AddContributionArgs) =>
      repos.investmentContributionService.addContribution(args),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(
        `No se pudo aportar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const withdrawMutation = useMutation({
    mutationFn: (args: WithdrawArgs) =>
      repos.investmentContributionService.withdraw(args),
    onSuccess: () => {
      invalidate();
      toast.success("Retirada registrada");
    },
    onError: (e) =>
      toast.error(
        `No se pudo retirar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (args: UpdateContributionArgs) =>
      repos.investmentContributionService.updateContribution(args),
    onSuccess: () => {
      invalidate();
      toast.success("Aportacion actualizada");
    },
    onError: (e) =>
      toast.error(
        `No se pudo editar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  // Crear inversion + primera aportacion de forma ATOMICA (si la aportacion
  // falla, no queda una inversion vacia). Sustituye al "create + add" suelto.
  const createWithContributionMutation = useMutation({
    mutationFn: (args: {
      investment: CreateInvestmentData;
      contribution: Omit<AddContributionArgs, "investmentId">;
    }) =>
      repos.investmentContributionService.createWithFirstContribution(
        args.investment,
        args.contribution,
      ),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(
        `No se pudo crear la inversion: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const removeMutation = useMutation({
    mutationFn: (args: { id: string; refundAccountId?: string | null }) =>
      repos.investmentContributionService.deleteContribution(
        args.id,
        args.refundAccountId,
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Aportacion eliminada");
    },
    onError: (e) =>
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  // --- Plan de aportacion periodica (Lote 13b-2) -------------------------

  const plansQuery = useQuery({
    queryKey: [...INVESTMENT_PLAN_KEY, investmentId ?? null],
    queryFn: async () =>
      investmentId
        ? repos.recurringRules.listByOrigen("investment", investmentId)
        : [],
    enabled: !!investmentId,
  });

  const invalidatePlan = () => {
    qc.invalidateQueries({ queryKey: INVESTMENT_PLAN_KEY });
    qc.invalidateQueries({ queryKey: ["recurringRules"] });
  };

  const savePlanMutation = useMutation({
    mutationFn: async (args: SavePlanArgs) => {
      if (!investmentId) throw new Error("Falta la inversion.");
      const patch = {
        nombre: `Aportacion · ${args.nombre}`,
        tipoMovimiento: "transferencia" as const,
        importe: args.importe,
        moneda: args.moneda,
        cuentaOrigenId: args.cuentaOrigenId,
        cuentaDestinoId: null,
        frecuencia: args.frecuencia,
        diaDelMes: args.diaDelMes,
        diaSemana: args.diaSemana,
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
        activa: true,
      };
      if (args.id) {
        await repos.recurringRules.update(args.id, patch);
      } else {
        await repos.recurringRules.create({
          ...patch,
          origenAutomatico: "investment",
          origenAutomaticoId: investmentId,
        });
      }
      // Genera ya las aportaciones pendientes hasta el mes actual.
      await repos.investmentContributionService.generatePeriodicContributions();
    },
    onSuccess: () => {
      invalidatePlan();
      invalidate();
      toast.success("Plan periodico guardado");
    },
    onError: (e) =>
      toast.error(
        `No se pudo guardar el plan: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const cancelPlanMutation = useMutation({
    mutationFn: (id: string) => repos.recurringRules.softDelete(id),
    onSuccess: () => {
      invalidatePlan();
      toast.success("Plan periodico cancelado");
    },
    onError: (e) =>
      toast.error(
        `No se pudo cancelar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  return {
    contributions: query.data ?? [],
    isLoading: query.isLoading,
    add: addMutation.mutateAsync,
    createWithContribution: createWithContributionMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    withdraw: withdrawMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    plans: plansQuery.data ?? [],
    savePlan: savePlanMutation.mutateAsync,
    cancelPlan: cancelPlanMutation.mutateAsync,
    isMutating:
      addMutation.isPending ||
      createWithContributionMutation.isPending ||
      updateMutation.isPending ||
      withdrawMutation.isPending ||
      removeMutation.isPending ||
      savePlanMutation.isPending ||
      cancelPlanMutation.isPending,
  };
}
