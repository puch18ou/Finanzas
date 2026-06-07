/**
 * src/lib/sync/lan.ts — Sincronizacion por LAN (Fase 2, Lote I)
 *
 * Dos roles:
 *   - SERVIDOR (el PC, host): arranca/para el mini-servidor Rust (tiny_http) y
 *     consulta su estado. La logica de responder a cada peticion la maneja
 *     SyncServerHandler (escucha el evento "sync://request").
 *   - CLIENTE (el movil): llama por HTTP al servidor del PC y ejecuta un
 *     intercambio completo (exchangeWith) usando el motor ya probado.
 */

import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { createSyncSession } from "./session-factory";
import {
  requestToWire,
  type ExchangeRequest,
  type ExchangeResponse,
  type PullStats,
} from "@/lib/domain/sync-session";

/** Puerto por defecto del servidor de sync. */
export const DEFAULT_SYNC_PORT = 8787;

/** Estado del servidor: [ip, puerto] o null si esta parado. */
export type SyncServerStatus = [string, number] | null;

// -- Lado SERVIDOR (PC) ------------------------------------------------------

export async function startSyncServer(
  port = DEFAULT_SYNC_PORT,
): Promise<string> {
  return invoke<string>("sync_server_start", { port });
}

export async function stopSyncServer(): Promise<void> {
  await invoke("sync_server_stop");
}

export async function getSyncServerStatus(): Promise<SyncServerStatus> {
  return invoke<SyncServerStatus>("sync_server_status");
}

// -- Lado CLIENTE (movil) ----------------------------------------------------

/** Normaliza "192.168.1.40:8787" -> "http://192.168.1.40:8787/". */
function toUrl(address: string): string {
  const a = address.trim();
  const withScheme = a.startsWith("http://") || a.startsWith("https://")
    ? a
    : `http://${a}`;
  return withScheme.endsWith("/") ? withScheme : `${withScheme}/`;
}

/**
 * Sincroniza con el servidor del PC en `address` (ip:puerto). Ejecuta un
 * intercambio bidireccional en una llamada y devuelve el resumen.
 */
export async function syncWithServer(address: string): Promise<PullStats> {
  const url = toUrl(address);
  const { session } = await createSyncSession();
  // Clave de par estable para los cursores (no conocemos el deviceId del PC
  // de antemano; la direccion sirve y los empates de LWW son inverosimiles).
  const peerKey = `lan:${address.trim()}`;

  return session.exchangeWith(peerKey, async (req: ExchangeRequest) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestToWire(req)),
    });
    if (!res.ok) {
      throw new Error(`El PC respondio ${res.status}. ¿Servidor encendido?`);
    }
    const data = (await res.json()) as ExchangeResponse | { error: string };
    if (data && typeof data === "object" && "error" in data) {
      throw new Error(String((data as { error: string }).error));
    }
    return data as ExchangeResponse;
  });
}
