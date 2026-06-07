"use client";

/**
 * src/components/sync/AutoSync.tsx — Sincronizacion automatica con el PC.
 *
 * Si este dispositivo tiene configurada la direccion de un PC (es decir, actua
 * de CLIENTE: el movil) y la sync automatica esta activada, sincroniza al abrir
 * la app y cada cierto intervalo, en silencio. Refresca la pantalla al traer
 * cambios (via useLanSync). Renderiza null.
 *
 * En el PC (servidor) no hay direccion configurada, asi que no hace nada.
 */

import { useEffect } from "react";
import { useLanSync } from "@/hooks/useLanSync";

const PC_ADDRESS_KEY = "sync:serverAddress";
const AUTO_KEY = "sync:auto";
const INTERVAL_MS = 30_000;

export function AutoSync() {
  const sync = useLanSync();

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const address = localStorage.getItem(PC_ADDRESS_KEY);
    const enabled = localStorage.getItem(AUTO_KEY) !== "0"; // por defecto ON
    if (!address || !enabled) return;

    let cancelled = false;
    let running = false;

    const tick = async () => {
      if (running || cancelled) return; // evita solapes
      running = true;
      try {
        await sync(address);
      } catch {
        // Silencioso: el PC puede estar apagado o fuera de la WiFi.
      } finally {
        running = false;
      }
    };

    void tick(); // al abrir
    const id = setInterval(tick, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sync]);

  return null;
}
