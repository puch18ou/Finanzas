"use client";

/**
 * src/hooks/useInvestments.ts
 *
 * Mismo patron que el resto de hooks CRUD. Expone updatePrice() ademas
 * de los update/create/delete habituales.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import {
  fetchQuote,
  fetchFundNavByIsin,
  type Quote,
} from "@/lib/services/quote-service";
import { convert, type RatesMap } from "@/lib/domain/currency";
import { usaParticipaciones } from "@/lib/domain/investments";
import type { Investment } from "@/lib/db/schema";
import type {
  CreateInvestmentData,
  UpdateInvestmentData,
} from "@/lib/repositories";

export const INVESTMENTS_KEY = ["investments"] as const;

export function useInvestments() {
  const repos = useRepos();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: INVESTMENTS_KEY,
    queryFn: () => repos.investments.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInvestmentData) => repos.investments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      toast.success("Inversion creada");
    },
    onError: (e) => {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: UpdateInvestmentData }) =>
      repos.investments.update(args.id, args.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      toast.success("Inversion actualizada");
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: (args: { id: string; precio: number }) =>
      repos.investments.updatePrice(args.id, args.precio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      // Toast mas discreto para no saturar (edicion inline)
    },
    onError: (e) => {
      toast.error(`No se pudo actualizar el precio: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  // Actualiza el precio desde la API de cotizacion. Sin toasts: los gestiona
  // quien lo llama (la pagina hace uno por activo o un resumen para "todas").
  // Si la cotizacion viene en otra moneda que el activo, la convierte con los
  // tipos de cambio (que pasa la pagina). Lanza si no hay ticker o si no hay
  // tipo de cambio para la conversion.
  const refreshQuoteMutation = useMutation({
    mutationFn: async ({ inv, rates }: { inv: Investment; rates: RatesMap }) => {
      const esFondo = !usaParticipaciones(inv.tipo);
      const tieneIsin = !!inv.isin && inv.isin.trim() !== "";
      const tieneTicker = !!inv.ticker && inv.ticker.trim() !== "";

      // Fuente del VL/precio:
      //  - Fondo (modo dinero) con ISIN -> Financial Times por ISIN. Es el VL
      //    OFICIAL; Yahoo no cubre fondos espanoles y da un VL desfasado.
      //  - Si FT no cubre ese ISIN pero hay ticker, respaldo a Yahoo (asi no se
      //    rompe Algebris y similares que ya cotizaban por ticker).
      //  - Resto de activos (Acciones/ETF/Cripto) -> Yahoo por ticker.
      let q: Quote | null = null;
      if (esFondo && tieneIsin) {
        try {
          q = await fetchFundNavByIsin(inv.isin!.trim());
        } catch (e) {
          if (!tieneTicker) throw e;
        }
      }
      if (!q) {
        if (!tieneTicker) {
          throw new Error(
            esFondo
              ? "El fondo no tiene ISIN cotizable ni ticker."
              : "Esta inversion no tiene ticker.",
          );
        }
        q = await fetchQuote(inv.ticker!);
      }
      // Precio/VL en la moneda del activo (convertido si hace falta).
      let valor = q.precio;
      let convertidoDe: string | null = null;
      if (q.moneda !== inv.moneda) {
        try {
          valor = convert(q.precio, q.moneda, inv.moneda, rates);
        } catch {
          throw new Error(
            `No hay tipo de cambio ${q.moneda}→${inv.moneda}. Anade la moneda en Monedas.`,
          );
        }
        convertidoDe = q.moneda;
      }

      if (usaParticipaciones(inv.tipo)) {
        // Activo por unidades: el VL es el precio por unidad directo.
        await repos.investments.updateQuote(inv.id, {
          precioActual: valor,
          ultimaCotizacionNav: valor,
        });
        return {
          modo: "precio" as const,
          valor,
          moneda: inv.moneda,
          convertidoDe,
        };
      }

      // Fondo "por dinero": valor de mercado = participaciones reales x VL.
      // Necesita que el usuario haya indicado sus unidades (unidadesCotizacion).
      const unidades = inv.unidadesCotizacion;
      if (unidades == null || unidades <= 0) {
        throw new Error(
          "Edita el fondo e indica tus participaciones (unidades) para cotizarlo.",
        );
      }
      if (inv.participaciones <= 0) {
        throw new Error("El fondo no tiene importe base; no se puede cotizar.");
      }
      // value = participaciones(importe) * precioActual  ->  fijamos precioActual
      // para que el valor sea exactamente unidades * VL.
      const total = unidades * valor;
      await repos.investments.updateQuote(inv.id, {
        precioActual: total / inv.participaciones,
        ultimaCotizacionNav: valor,
      });
      return {
        modo: "fondo" as const,
        valor: total,
        vl: valor,
        moneda: inv.moneda,
        convertidoDe,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
    },
  });

  const deleteMutation = useMutation({
    // Borra la inversion devolviendo el dinero de sus aportaciones a las cuentas.
    mutationFn: (id: string) =>
      repos.investmentContributionService.deleteInvestment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      qc.invalidateQueries({ queryKey: ["investmentContributions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Inversion movida a la papelera (dinero devuelto)");
    },
    onError: (e) => {
      toast.error(`No se pudo borrar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      repos.investmentContributionService.archiveInvestment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      qc.invalidateQueries({ queryKey: ["investmentsArchived"] });
      qc.invalidateQueries({ queryKey: ["recurringRules"] });
      qc.invalidateQueries({ queryKey: ["investmentPlan"] });
      toast.success("Inversion archivada");
    },
    onError: (e) => {
      toast.error(`No se pudo archivar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) =>
      repos.investmentContributionService.unarchiveInvestment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVESTMENTS_KEY });
      qc.invalidateQueries({ queryKey: ["investmentsArchived"] });
      toast.success("Inversion desarchivada");
    },
    onError: (e) => {
      toast.error(`No se pudo desarchivar: ${e instanceof Error ? e.message : "error"}`);
    },
  });

  return {
    investments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    updatePrice: updatePriceMutation.mutateAsync,
    refreshQuote: refreshQuoteMutation.mutateAsync,
    isRefreshingQuote: refreshQuoteMutation.isPending,
    remove: deleteMutation.mutateAsync,
    archive: archiveMutation.mutateAsync,
    unarchive: unarchiveMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      updatePriceMutation.isPending ||
      deleteMutation.isPending ||
      archiveMutation.isPending ||
      unarchiveMutation.isPending,
  };
}
