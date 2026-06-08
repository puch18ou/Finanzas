/**
 * src/lib/domain/auto-id.ts — IDs DETERMINISTAS para filas auto-generadas.
 *
 * Las reglas periodicas (gastos, transferencias, cuotas, aportaciones) se
 * materializan en CADA dispositivo por separado. Si cada uno usara un id
 * aleatorio, la misma ocurrencia tendria PKs distintas en PC y movil y, al
 * sincronizar (LWW por clave primaria), apareceria DUPLICADA.
 *
 * Solucion: derivar el id de forma determinista a partir de la identidad
 * natural de la ocurrencia (la regla de origen + la clave del periodo, la
 * MISMA que usa cada servicio para deduplicar). Asi ambos dispositivos generan
 * EXACTAMENTE el mismo id y el sync las fusiona en una sola fila.
 *
 * El prefijo evita colisiones con ids aleatorios (nanoid) ya existentes y entre
 * tipos de fila.
 */

export function autoGenId(
  prefix: string,
  origenAutomaticoId: string,
  periodKey: string,
): string {
  return `${prefix}-${origenAutomaticoId}-${periodKey}`;
}
