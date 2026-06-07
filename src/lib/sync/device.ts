/**
 * ============================================================================
 *  src/lib/sync/device.ts — Identidad del dispositivo (Fase 2, sync P2P)
 * ============================================================================
 *
 *  Cada INSTALACION de la app (un portatil, un movil) tiene un `deviceId`
 *  estable: un UUID generado la primera vez y guardado en localStorage. Es
 *  per-dispositivo, NO per-usuario: identifica la maquina fisica
 *  independientemente de que usuario tenga la sesion abierta. Por eso vive en
 *  localStorage (como `fx:lastRefresh` o `auth:rememberedUserId`) y no en la
 *  BD del usuario, que ademas se sincroniza.
 *
 *  El `deviceId` se usa como desempate determinista del last-write-wins
 *  (ver domain/sync.ts: compareVersions) y como clave de los cursores por par
 *  (tabla sync_state).
 * ============================================================================
 */

const DEVICE_ID_KEY = "sync:deviceId";
const DEVICE_NAME_KEY = "sync:deviceName";

/**
 * Devuelve el deviceId de esta instalacion, creandolo la primera vez. Estable
 * entre reinicios. Lanza si se llama en un entorno sin localStorage (SSR);
 * la app es client-only, asi que en la practica siempre hay window.
 */
export function getDeviceId(): string {
  if (typeof localStorage === "undefined") {
    throw new Error("getDeviceId solo disponible en cliente");
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Nombre legible de este dispositivo para mostrar al par (opcional). */
export function getDeviceName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(DEVICE_NAME_KEY);
}

/** Fija el nombre legible de este dispositivo ("Portatil de Pedro"). */
export function setDeviceName(name: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DEVICE_NAME_KEY, name);
}
