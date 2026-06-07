"use client";

/**
 * src/hooks/useSync.ts — Sincronizacion por fichero (Fase 2, Lote G-2)
 *
 * MVP de sincronizacion multi-dispositivo SIN red: cada dispositivo EXPORTA un
 * "paquete" con todos sus datos (un snapshot) e IMPORTA el del otro. Al
 * importar, el motor fusiona por last-write-wins (gana el updatedAt mayor) y
 * propaga borrados via lapidas. Como el merge es idempotente, mandar el
 * snapshot entero cada vez es correcto (los cursores se usaran luego para el
 * transporte por red, no aqui).
 *
 * Flujo tipico PC <-> movil:
 *   1. En el PC: "Exportar" -> guarda finanzas-sync-<id>.json.
 *   2. Pasas el fichero al movil (nube, cable, lo que sea).
 *   3. En el movil: "Importar" -> fusiona los datos del PC.
 *   4. (y al reves para que el PC reciba los cambios del movil).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getDb } from "@/lib/db/client";
import { getDeviceId } from "@/lib/sync/device";
import { DbSyncStore } from "@/lib/sync/db-sync-store";
import {
  SyncSession,
  payloadToWire,
  type PullResponse,
} from "@/lib/domain/sync-session";
import { downloadJson, readJsonFile } from "@/lib/services/backup-service";

const BUNDLE_APP = "finanzas-sync";
const BUNDLE_VERSION = 1 as const;

/** Formato del fichero de sincronizacion. */
export interface SyncBundle {
  app: typeof BUNDLE_APP;
  version: typeof BUNDLE_VERSION;
  /** deviceId del dispositivo que exporto (desempate del LWW). */
  deviceId: string;
  exportedAt: number;
  /** Snapshot de datos (filas por tabla + lapidas), en forma serializable. */
  payload: PullResponse;
}

function isSyncBundle(obj: unknown): obj is SyncBundle {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;
  return (
    b.app === BUNDLE_APP &&
    b.version === BUNDLE_VERSION &&
    typeof b.deviceId === "string" &&
    typeof b.payload === "object" &&
    b.payload !== null
  );
}

async function makeSession(): Promise<{ session: SyncSession; deviceId: string }> {
  const db = await getDb();
  const deviceId = getDeviceId();
  const store = new DbSyncStore(db, deviceId);
  return { session: new SyncSession(store), deviceId };
}

export function useSync() {
  const qc = useQueryClient();

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { session, deviceId } = await makeSession();
      // serve(0) = TODOS los cambios (snapshot completo).
      const payload = await session.serve(0);
      const bundle: SyncBundle = {
        app: BUNDLE_APP,
        version: BUNDLE_VERSION,
        deviceId,
        exportedAt: Date.now(),
        payload: payloadToWire(payload),
      };
      const shortId = deviceId.slice(0, 8);
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`finanzas-sync-${shortId}-${date}.json`, bundle);
      return bundle;
    },
    onSuccess: () => {
      toast.success("Paquete de sincronizacion exportado");
    },
    onError: (e) => {
      toast.error(
        `No se pudo exportar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const obj = await readJsonFile(file);
      if (!isSyncBundle(obj)) {
        throw new Error("El fichero no es un paquete de sincronizacion valido.");
      }
      const { session, deviceId } = await makeSession();
      if (obj.deviceId === deviceId) {
        throw new Error(
          "Ese paquete es de ESTE mismo dispositivo. Importa el del otro.",
        );
      }
      return session.applyPayload(obj.payload, obj.deviceId);
    },
    onSuccess: (stats) => {
      qc.invalidateQueries(); // puede cambiar cualquier cosa
      const cambios = stats.appliedRows + stats.deletedRows;
      toast.success(
        cambios === 0
          ? "Sincronizado: ya estaba todo al dia"
          : `Sincronizado: ${stats.appliedRows} actualizados, ${stats.deletedRows} borrados`,
      );
    },
    onError: (e) => {
      toast.error(
        `No se pudo importar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    exportBundle: exportMutation.mutateAsync,
    importBundle: importMutation.mutateAsync,
    isExporting: exportMutation.isPending,
    isImporting: importMutation.isPending,
  };
}
