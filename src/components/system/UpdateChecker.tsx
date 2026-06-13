"use client";

/**
 * src/components/system/UpdateChecker.tsx — Auto-update de ESCRITORIO.
 *
 * Al arrancar (una vez), comprueba si hay una version nueva publicada en
 * GitHub Releases (via el plugin updater de Tauri, que lee el manifiesto
 * latest.json firmado). Si la hay, avisa con un toast y, al pulsar, descarga +
 * instala + reinicia.
 *
 * SOLO escritorio: el updater de Tauri no soporta Android/iOS (en movil se usa
 * un flujo asistido aparte). Por eso se cortocircuita en movil y los imports
 * del plugin son dinamicos.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isMobileApp } from "@/lib/utils/platform";

/** Descarga, instala y reinicia con la actualizacion ya obtenida. */
async function installUpdate(update: {
  version: string;
  downloadAndInstall: () => Promise<void>;
}): Promise<void> {
  const t = toast.loading(`Descargando la version ${update.version}...`);
  try {
    await update.downloadAndInstall();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    toast.dismiss(t);
    toast.success("Actualizado. Reiniciando...");
    await relaunch();
  } catch (e) {
    toast.dismiss(t);
    toast.error(
      `No se pudo actualizar: ${e instanceof Error ? e.message : "error"}`,
    );
  }
}

/** Comprueba si hay actualizacion. `silencioso` no avisa si esta al dia. */
export async function checkForUpdates(silencioso = false): Promise<void> {
  if (isMobileApp()) return; // el updater no existe en movil
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      if (!silencioso) toast.success("Ya tienes la ultima version.");
      return;
    }
    toast.info(`Version ${update.version} disponible`, {
      duration: Infinity,
      action: {
        label: "Actualizar",
        onClick: () => void installUpdate(update),
      },
    });
  } catch (e) {
    // En dev/web no hay updater, o no hay red: silencioso salvo peticion manual.
    if (!silencioso) {
      toast.error(
        `No se pudo comprobar actualizaciones: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }
}

export function UpdateChecker() {
  const lanzado = useRef(false);
  useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    void checkForUpdates(true); // al arrancar, silencioso si esta al dia
  }, []);
  return null;
}
