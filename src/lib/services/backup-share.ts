/**
 * ============================================================================
 *  src/lib/services/backup-share.ts — Compartir el backup JSON en Android
 * ============================================================================
 *
 *  En el movil, la "descarga" del navegador (<a download>) va a una carpeta
 *  que decide el sistema y el usuario no sabe donde queda. En su lugar
 *  escribimos el JSON en la carpeta de cache de la app y lanzamos el SELECTOR
 *  DE COMPARTIR de Android (ACTION_SEND): asi el usuario decide que hacer con
 *  el fichero (guardarlo en Archivos/Drive, enviarlo por email/WhatsApp, etc).
 *
 *  Mismo patron que el auto-update del APK (apk-update-service.ts): escribimos
 *  a appCacheDir y disparamos una Activity nativa via un esquema propio
 *  (`finanzas-share://`) con el plugin opener. La Activity (ShareActivity.kt)
 *  construye el intent con una URI de FileProvider (content://), que es como
 *  Android exige compartir ficheros en 7+.
 *
 *  Este modulo importa plugins de Tauri en el top-level, por eso vive SEPARADO
 *  de backup-service.ts (que se usa en tests sobre Node, sin Tauri).
 * ============================================================================
 */

import { open } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { appCacheDir, join } from "@tauri-apps/api/path";

/**
 * Escribe el backup JSON en la cache de la app y abre el selector de compartir
 * de Android para que el usuario decida donde enviarlo/guardarlo.
 */
export async function shareBackupJson(
  filename: string,
  data: unknown,
): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  const dir = await appCacheDir();
  const dest = await join(dir, filename);

  const file = await open(dest, { write: true, create: true, truncate: true });
  try {
    await file.write(new TextEncoder().encode(text));
  } finally {
    await file.close();
  }

  await openUrl(`finanzas-share://share?path=${encodeURIComponent(dest)}`);
}
