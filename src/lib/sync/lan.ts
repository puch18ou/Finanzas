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
import { setActiveDbPath, getRawDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { createSyncSession } from "./session-factory";
import {
  requestToWire,
  type ExchangeRequest,
  type ExchangeResponse,
  type PullResponse,
  type PullStats,
} from "@/lib/domain/sync-session";

/** Puerto por defecto del servidor de sync. */
export const DEFAULT_SYNC_PORT = 8787;

/** Estado del servidor: [ip, puerto] o null si esta parado. */
export type SyncServerStatus = [string, number] | null;

// -- Emparejamiento por QR ---------------------------------------------------

/** Datos que viajan en el QR (NO el PIN, eso se teclea siempre). */
export interface PairingInfo {
  address: string;
  username: string;
}

/** Codifica los datos de emparejamiento para meterlos en un QR. */
export function encodePairing(address: string, username: string): string {
  return JSON.stringify({ v: 1, a: address, u: username });
}

/** Decodifica el texto de un QR escaneado. Devuelve null si no es valido. */
export function decodePairing(text: string): PairingInfo | null {
  try {
    const o = JSON.parse(text) as { a?: unknown; u?: unknown };
    if (typeof o.a === "string" && typeof o.u === "string" && o.a.includes(":")) {
      return { address: o.a, username: o.u };
    }
  } catch {
    // texto no-JSON
  }
  return null;
}

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
    // Pedimos por el cliente HTTP nativo (comando Rust): no pasa por el scope
    // del plugin HTTP, asi que funciona en cualquier IP de la LAN (Android
    // rechazaba las IPs con comodin del scope).
    const data = await postToServer<ExchangeResponse>(url, {
      kind: "exchange",
      req: requestToWire(req),
    });
    return data;
  });
}

/**
 * POST JSON al servidor de sync del PC via el comando nativo `lan_http_post`
 * (TcpStream en Rust, sin el scope del plugin HTTP). Traduce los fallos de red
 * en un mensaje accionable y propaga los errores que devuelva el motor (PIN
 * incorrecto, etc.) tal cual.
 */
async function postToServer<T>(
  url: string,
  payload: unknown,
): Promise<T> {
  let bodyText: string;
  try {
    bodyText = await invoke<string>("lan_http_post", {
      url,
      body: JSON.stringify(payload),
    });
  } catch {
    // No se pudo abrir la conexion con el PC: mensaje claro y accionable en vez
    // del error de red crudo.
    throw new Error(
      "No se pudo conectar con el PC. Comprueba que la app de escritorio este abierta con el servidor ENCENDIDO, que ambos esten en la MISMA WiFi y que la direccion/QR sea la actual (la IP del PC puede cambiar).",
    );
  }
  const data = JSON.parse(bodyText) as T | { error: string };
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

// -- Aprovisionamiento: traer un usuario del PC a un dispositivo nuevo --------

/** Metadatos del usuario que devuelve el PC al aprovisionar (sin PIN). */
export interface ProvisionUser {
  username: string;
  role: "user" | "admin";
  mustChangePin: boolean;
}

export interface ProvisionResult {
  user: ProvisionUser;
  /** Snapshot completo de la BD del usuario (forma wire). */
  snapshot: PullResponse;
}

/**
 * Pide al PC el usuario `username` (verificando el PIN) y su snapshot de datos.
 * Lanza si el PIN es incorrecto o el servidor no responde.
 */
export async function provisionFromServer(
  address: string,
  username: string,
  pin: string,
): Promise<ProvisionResult> {
  return postToServer<ProvisionResult>(toUrl(address), {
    kind: "provision",
    username,
    pin,
  });
}

/**
 * Inicializa la BD de un usuario recien creado en este dispositivo con el
 * snapshot traido del PC: fija la ruta, aplica migraciones (crea las tablas) y
 * vuelca todos los datos. Como la BD esta vacia, applyPayload los inserta tal
 * cual; el seed posterior (al loguear) se salta porque ya hay datos.
 */
export async function initProvisionedDb(
  dbFile: string,
  snapshot: PullResponse,
  peerKey: string,
): Promise<void> {
  setActiveDbPath(`sqlite:${dbFile}`);
  await runMigrations();
  // Volcado masivo: desactivamos las FK mientras importamos para no depender
  // del orden exacto entre tablas. El snapshot viene integro del PC, asi que
  // la integridad se mantiene al re-activarlas.
  const raw = await getRawDb();
  await raw.execute("PRAGMA foreign_keys = OFF");
  try {
    const { session } = await createSyncSession();
    await session.applyPayload(snapshot, peerKey);
  } finally {
    await raw.execute("PRAGMA foreign_keys = ON");
  }
}
