"use client";

/**
 * src/hooks/useLanSync.ts — Sincronizar con el PC y refrescar la pantalla.
 *
 * Envuelve syncWithServer (intercambio por LAN) y, si entraron cambios,
 * invalida las queries de TanStack Query para que la UI se actualice sola.
 * Lo usan el boton manual de Ajustes y el AutoSync.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncWithServer } from "@/lib/sync/lan";
import type { PullStats } from "@/lib/domain/sync-session";

export function useLanSync() {
  const qc = useQueryClient();

  return useCallback(
    async (address: string): Promise<PullStats> => {
      const stats = await syncWithServer(address);
      // Si llegaron cambios del PC, refrescamos la UI.
      if (stats.appliedRows + stats.deletedRows > 0) {
        qc.invalidateQueries();
      }
      return stats;
    },
    [qc],
  );
}
