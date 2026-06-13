"use client";

/**
 * src/components/system/MobileUpdateChecker.tsx — Auto-update ASISTIDO de movil.
 *
 * El updater de Tauri no soporta Android. Aqui, al arrancar (solo en movil),
 * consultamos la ultima release de GitHub: si hay una version mas nueva que la
 * instalada y tiene un APK adjunto, avisamos con un toast y un boton que ABRE
 * el APK (lo descarga el navegador del sistema); el usuario lo toca para
 * instalar.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isMobileApp } from "@/lib/utils/platform";
import { isNewerVersion } from "@/lib/utils/version";

const REPO = "puch18ou/Finanzas";

type GithubRelease = {
  tag_name?: string;
  assets?: { name?: string; browser_download_url?: string }[];
};

async function descargarApk(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch (e) {
    toast.error(
      `No se pudo abrir la descarga: ${e instanceof Error ? e.message : "error"}`,
    );
  }
}

export function MobileUpdateChecker() {
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current || !isMobileApp()) return;
    lanzado.current = true;

    void (async () => {
      try {
        const { fetch } = await import("@tauri-apps/plugin-http");
        const { getVersion } = await import("@tauri-apps/api/app");
        const actual = await getVersion();

        const res = await fetch(
          `https://api.github.com/repos/${REPO}/releases/latest`,
          { method: "GET", headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as GithubRelease;

        const ultima = String(data.tag_name ?? "").replace(/^v/, "");
        if (!ultima || !isNewerVersion(ultima, actual)) return;

        const apk = (data.assets ?? []).find((a) =>
          String(a.name ?? "").toLowerCase().endsWith(".apk"),
        );
        if (!apk?.browser_download_url) return;
        const url = apk.browser_download_url;

        toast.info(`Nueva version ${ultima} disponible`, {
          duration: Infinity,
          action: {
            label: "Descargar",
            onClick: () => void descargarApk(url),
          },
        });
      } catch {
        // sin red, o no es movil real (dev/web): ignorar en silencio.
      }
    })();
  }, []);

  return null;
}
