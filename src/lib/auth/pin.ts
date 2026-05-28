/**
 * ============================================================================
 *  src/lib/auth/pin.ts — Hash y verificacion de PINs
 * ============================================================================
 *
 *  El PIN del usuario NUNCA se guarda en claro. Derivamos un hash con
 *  PBKDF2-SHA256 + salt aleatorio por usuario usando la Web Crypto API
 *  (crypto.subtle), disponible tanto en el webview de Tauri como en Node 20+.
 *
 *  Formato de PIN: entre 4 y 8 digitos (solo numeros).
 * ============================================================================
 */

const ITERATIONS = 150_000;
const KEY_LEN_BITS = 256;
const SALT_BYTES = 16;

const PIN_REGEX = /^[0-9]{4,8}$/;

/** True si el PIN tiene formato valido (4-8 digitos). */
export function validatePinFormat(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveBits(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LEN_BITS,
  );
  return new Uint8Array(bits);
}

/** Comparacion en tiempo (casi) constante para evitar timing attacks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Deriva un hash del PIN con un salt aleatorio nuevo.
 * Devuelve hash y salt en base64 para guardarlos en el registro.
 */
export async function hashPin(
  pin: string,
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(pin, salt);
  return { hash: bytesToBase64(hash), salt: bytesToBase64(salt) };
}

/** Verifica un PIN contra el hash y salt guardados (ambos en base64). */
export async function verifyPin(
  pin: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const derived = await deriveBits(pin, base64ToBytes(salt));
  return timingSafeEqual(derived, base64ToBytes(hash));
}
