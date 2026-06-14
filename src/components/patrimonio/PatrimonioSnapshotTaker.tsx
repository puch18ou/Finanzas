"use client";

/**
 * ============================================================================
 *  src/components/patrimonio/PatrimonioSnapshotTaker.tsx
 * ============================================================================
 *
 *  Guarda una FOTO DIARIA del patrimonio (valor neto + desglose) para poder
 *  dibujar su evolucion real. La foto se valora en la moneda LOCAL (base
 *  estable) y se guarda con id determinista por dia (la ultima del dia gana).
 *
 *  Re-captura cuando el patrimonio cambia durante la sesion (tras refrescar
 *  cotizaciones, anadir un movimiento...), pero solo escribe si el valor ha
 *  cambiado de verdad — asi hoy siempre refleja el ultimo valor sin spam de
 *  escrituras. No pinta nada. Se monta dentro de DatabaseReady.
 * ============================================================================
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccountBalances } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import { useRepos } from "@/contexts/DatabaseProvider";
import { buildRatesMap } from "@/lib/domain/currency";
import { computeNetWorth } from "@/lib/domain/networth";
import { normalizeDateToUTCNoon } from "@/lib/utils/dates";
import { PATRIMONIO_SNAPSHOTS_KEY } from "@/hooks/usePatrimonioSnapshots";
import { recordHealthError, clearHealthError } from "@/lib/utils/health-log";

export function PatrimonioSnapshotTaker() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, balances, isLoading: accLoading } = useAccountBalances();
  const { investments, isLoading: invLoading } = useInvestments();
  const { mortgage } = useMortgage();
  const { debts } = useOtherDebts();
  const repos = useRepos();
  const queryClient = useQueryClient();

  // Ultimo valor (neto, en centimos) ya escrito en ESTA sesion: si no cambia,
  // no reescribimos la foto del dia.
  const ultimoEscrito = useRef<number | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (accLoading || invLoading) return;
    if (currencies.length === 0) return;

    const rates = buildRatesMap(currencies);
    const moneda = settings.monedaLocal ?? "EUR";
    const nw = computeNetWorth({
      accounts,
      balances,
      investments,
      mortgage: mortgage ?? null,
      debts,
      rates,
      currency: moneda,
    });

    const clave = Math.round(nw.patrimonioNeto * 100);
    if (ultimoEscrito.current === clave) return;
    ultimoEscrito.current = clave;

    const fecha = normalizeDateToUTCNoon(new Date());
    repos.patrimonioSnapshots
      .upsertForDay({ fecha, moneda, ...nw })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: PATRIMONIO_SNAPSHOTS_KEY });
        clearHealthError("snapshot");
      })
      .catch((e) => {
        console.error("[snapshot] no se pudo guardar el patrimonio del dia", e);
        recordHealthError("snapshot", e);
      });
  }, [
    settings,
    currencies,
    accounts,
    balances,
    investments,
    mortgage,
    debts,
    accLoading,
    invLoading,
    repos,
    queryClient,
  ]);

  return null;
}
