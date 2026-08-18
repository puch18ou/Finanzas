/**
 * ============================================================================
 *  src/lib/services/apk-update-service.ts — Auto-update in-app (Android)
 * ============================================================================
 *
 *  Flujo: comprobar GitHub -> descargar el APK POR TROZOS (streaming) a la
 *  carpeta de cache mostrando progreso -> lanzar el instalador de Android.
 *
 *  La descarga es en streaming (leer el cuerpo por trozos y escribir el fichero
 *  poco a poco) para NO cargar los ~27MB de golpe en memoria (eso colgaba la
 *  version anterior). Da progreso real por el Content-Length.
 *
 *  Android NO instala en silencio: tras `installApk` sale la pantalla del
 *  sistema y el usuario pulsa Instalar. Si algo falla, el caller cae a abrir la
 *  URL en el navegador (openInBrowser).
 * ============================================================================
 */

import { fetch } from "@tauri-apps/plugin-http";
import { open } from "@tauri-apps/plugin-fs";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { isNewerVersion } from "@/lib/utils/version";

const REPO = "puch18ou/Finanzas";
const APK_FILENAME = "finanzas-update.apk";

export type UpdateInfo = { version: string; url: string };

type GithubRelease = {
  tag_name?: string;
  assets?: { name?: string; browser_download_url?: string }[];
};

/** Consulta la ultima release; devuelve {version,url} si es mas nueva, o null. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const actual = await getVersion();
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { method: "GET", headers: { Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as GithubRelease;

  const version = String(data.tag_name ?? "").replace(/^v/, "");
  if (!version || !isNewerVersion(version, actual)) return null;

  const apk = (data.assets ?? []).find((a) =>
    String(a.name ?? "").toLowerCase().endsWith(".apk"),
  );
  if (!apk?.browser_download_url) return null;
  return { version, url: apk.browser_download_url };
}

/**
 * Descarga el APK por trozos a la carpeta de cache. Llama a onProgress(0..1)
 * segun avanza. Devuelve la ruta del fichero. Lanza con un mensaje que indica
 * el paso que fallo (para diagnostico).
 */
export async function downloadApk(
  url: string,
  onProgress: (fraction: number) => void,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(`descarga (red): ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) throw new Error(`descarga: HTTP ${res.status}`);

  const total = Number(res.headers.get("content-length") ?? 0);
  const body = res.body;
  if (!body) throw new Error("descarga: respuesta sin cuerpo");

  const dir = await appCacheDir();
  const dest = await join(dir, APK_FILENAME);

  let file;
  try {
    file = await open(dest, { write: true, create: true, truncate: true });
  } catch (e) {
    throw new Error(`abrir fichero: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const reader = body.getReader();
    let downloaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        await file.write(value);
        downloaded += value.byteLength;
        onProgress(total > 0 ? Math.min(1, downloaded / total) : 0);
      }
    }
  } catch (e) {
    throw new Error(`escribir fichero: ${e instanceof Error ? e.message : e}`);
  } finally {
    await file.close();
  }

  return dest;
}

/** Lanza el instalador de Android para el APK descargado (via FileProvider). */
export async function installApk(path: string): Promise<void> {
  try {
    await openPath(path);
  } catch (e) {
    throw new Error(`abrir instalador: ${e instanceof Error ? e.message : e}`);
  }
}

/** Fallback: abrir la URL en el navegador (descarga como el metodo antiguo). */
export async function openInBrowser(url: string): Promise<void> {
  await openUrl(url);
}
