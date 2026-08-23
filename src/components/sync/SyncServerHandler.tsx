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

import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthProvider";
import { isDemoModeActive } from "@/contexts/DatabaseProvider";
import { createSyncSession } from "@/lib/sync/session-factory";
import { payloadToWire, type ExchangeRequest } from "@/lib/domain/sync-session";
import { verifyLogin } from "@/lib/auth/registry";

export function SyncServerHandler() {
  const qc = useQueryClient();
  const { user } = useAuth();
  // Ref para leer el usuario actual dentro del listener sin re-registrarlo.
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    listen<{ id: number; body: string }>("sync://request", async (event) => {
      const { id, body } = event.payload;
      let respBody: string;
      let changed = false;
      // Demo en curso: no tocamos ninguna BD. Respondemos con error para que el
      // movil reintente mas tarde (cuando el demo termine y vuelva la BD real).
      if (isDemoModeActive()) {
        try {
          await invoke("sync_respond", {
            id,
            body: JSON.stringify({
              error: "El PC esta mostrando la guia de ejemplo. Reintenta en un momento.",
            }),
          });
        } catch {
          /* el servidor ya no espera: ignorar */
        }
        return;
      }
      try {
        const msg = JSON.parse(body) as {
          kind?: string;
          req?: ExchangeRequest;
          username?: string;
          pin?: string;
        };

        if (msg.kind === "provision") {
          // Aprovisionar un dispositivo nuevo: verificar PIN y servir el
          // snapshot. Solo se puede traer el usuario que tiene la sesion
          // ABIERTA en el PC: asi servimos desde la sesion activa (la via
          // probada) y es mas seguro.
          const verified = await verifyLogin(msg.username ?? "", msg.pin ?? "");
          const current = userRef.current;
          if (!verified || !verified.dbFile) {
            respBody = JSON.stringify({
              error: "Usuario o PIN incorrecto en el PC.",
            });
          } else if (!current || current.username !== verified.username) {
            respBody = JSON.stringify({
              error:
                "Abre la sesion de ese usuario en el PC antes de traerlo al movil.",
            });
          } else {
            const { session } = await createSyncSession();
            const snapshot = await session.serve(0);
            respBody = JSON.stringify({
              user: {
                username: verified.username,
                role: verified.role,
                mustChangePin: verified.mustChangePin,
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
