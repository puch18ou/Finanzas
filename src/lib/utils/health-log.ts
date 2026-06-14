/**
 * ============================================================================
 *  src/lib/utils/health-log.ts — Registro de fallos de datos automaticos
 * ============================================================================
 *
 *  Los refrescos automaticos (tipos de cambio, cotizaciones, foto de
 *  patrimonio) son best-effort y fallan en SILENCIO (van a console.error,
 *  invisibles para el usuario). Aqui guardamos el ULTIMO fallo por canal en
 *  localStorage para que la tarjeta de Salud lo muestre. Al ir bien, se limpia.
 * ============================================================================
 */

export type HealthChannel = "fx" | "quotes" | "snapshot";
export type HealthError = { message: string; at: number };

const KEY = (ch: HealthChannel) => `health:err:${ch}`;

/** Registra el ultimo fallo de un canal (con marca de tiempo). */
export function recordHealthError(ch: HealthChannel, message: unknown): void {
  try {
    const msg =
      message instanceof Error ? message.message : String(message ?? "error");
    localStorage.setItem(
      KEY(ch),
      JSON.stringify({ message: msg.slice(0, 300), at: Date.now() }),
    );
  } catch {
    // localStorage no disponible: ignoramos.
  }
}

/** Limpia el fallo de un canal (se llama cuando vuelve a ir bien). */
export function clearHealthError(ch: HealthChannel): void {
  try {
    localStorage.removeItem(KEY(ch));
  } catch {
    // ignorar
  }
}

/** Lee el ultimo fallo registrado de un canal, o null si no hay. */
export function readHealthError(ch: HealthChannel): HealthError | null {
  try {
    const raw = localStorage.getItem(KEY(ch));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<HealthError>;
    if (typeof o?.message === "string" && typeof o?.at === "number") {
      return { message: o.message, at: o.at };
    }
  } catch {
    // ignorar
  }
  return null;
}
