"use client";

/**
 * src/components/sync/SyncServerHandler.tsx — Puente JS del servidor (Lote I-2)
 *
 * Montado para usuarios logueados (ver AuthGate). Escucha el evento
 * "sync://request" que emite el mini-servidor Rust por cada peticion HTTP del
 * cliente (movil), la procesa con el motor de sync ya probado
 * (SyncSession.handleExchange) y devuelve la respuesta via el comando
 * `sync_respond`. Asi el servidor Rust es tonto y la fusion vive solo en TS.
 *
 * Renderiza null: es solo logica. Esta siempre escuchando; solo recibe eventos
 * cuando el servidor esta encendido (lo controla la tarjeta de Ajustes).
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  createSyncSession,
  serveSnapshotForDbFile,
} from "@/lib/sync/session-factory";
import { payloadToWire, type ExchangeRequest } from "@/lib/domain/sync-session";
import { verifyLogin } from "@/lib/auth/registry";

export function SyncServerHandler() {
  const qc = useQueryClient();

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    listen<{ id: number; body: string }>("sync://request", async (event) => {
      const { id, body } = event.payload;
      let respBody: string;
      let changed = false;
      try {
        const msg = JSON.parse(body) as {
          kind?: string;
          req?: ExchangeRequest;
          username?: string;
          pin?: string;
        };

        if (msg.kind === "provision") {
          // Aprovisionar un dispositivo nuevo: verificar PIN y servir su BD.
          const user = await verifyLogin(msg.username ?? "", msg.pin ?? "");
          if (!user || !user.dbFile) {
            respBody = JSON.stringify({
              error: "Usuario o PIN incorrecto en el PC.",
            });
          } else {
            const snapshot = await serveSnapshotForDbFile(user.dbFile);
            respBody = JSON.stringify({
              user: {
                username: user.username,
                role: user.role,
                mustChangePin: user.mustChangePin,
              },
              snapshot: payloadToWire(snapshot),
            });
          }
        } else {
          // Intercambio normal (sync bidireccional).
          const req = (msg.kind === "exchange" ? msg.req : msg) as ExchangeRequest;
          const { session } = await createSyncSession();
          const resp = await session.handleExchange(req);
          // A "wire" (Date -> ms) para que viaje por JSON sin corromper fechas.
          respBody = JSON.stringify({ pull: payloadToWire(resp.pull) });
          changed = true;
        }
      } catch (e) {
        respBody = JSON.stringify({
          error: e instanceof Error ? e.message : "error procesando sync",
        });
      }
      try {
        await invoke("sync_respond", { id, body: respBody });
      } catch {
        // si el servidor ya no espera, no pasa nada
      }
      // El cliente pudo empujarnos cambios: refrescamos la UI.
      if (changed) qc.invalidateQueries();
    }).then((u) => {
      if (active) unlisten = u;
      else u();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [qc]);

  return null;
}
