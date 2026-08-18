/**
 * ============================================================================
 *  src/lib/services/apk-update-service.ts — Auto-update in-app (Android)
 * ============================================================================
 *
 *  Descarga el APK de la nueva version DENTRO de la app (a la carpeta de cache)
 *  y lanza el instalador de Android directamente, en vez de abrir el navegador.
 *
 *  Android NO permite instalar en silencio: tras esto sale la pantalla del
 *  sistema "¿Instalar actualizacion?" y el usuario pulsa Instalar. Pero se
 *  ahorra ir al navegador y buscar el archivo descargado.
 *
 *  Requisitos (ya configurados):
 *   - permiso REQUEST_INSTALL_PACKAGES en el manifest.
 *   - FileProvider (lo aporta Tauri) con cache-path -> openPath puede exponer
 *     el APK del cache al instalador.
 *   - scope http para github.com / *.githubusercontent.com (descarga del asset)
 *     y scope fs para $APPCACHE.
 *
 *  El caller hace el fallback a abrir la URL en el navegador si esto falla.
 * ============================================================================
 */

import { fetch } from "@tauri-apps/plugin-http";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { appCacheDir, join } from "@tauri-apps/api/path";

const APK_FILENAME = "finanzas-update.apk";

/**
 * Descarga el APK de `url` y abre el instalador de Android. Lanza si falla la
 * descarga o la apertura (el caller decide el fallback).
 */
export async function downloadAndInstallApk(url: string): Promise<void> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`La descarga respondio ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("La descarga llego vacia");
  }

  // Guardamos en la carpeta de cache de la app (la que expone el FileProvider).
  const dir = await appCacheDir();
  const apkPath = await join(dir, APK_FILENAME);
  await writeFile(apkPath, bytes);

  // Abrir el APK -> Android lanza el instalador (via FileProvider).
  await openPath(apkPath);
}
