"use client";

/**
 * src/components/system/CurrentPeriodSync.tsx
 *
 * Al ARRANCAR la app, fija el "periodo actual" (settings.mesActual/anioActual)
 * al mes REAL del dispositivo. Asi, al abrir, el dashboard, movimientos, etc.
 * muestran siempre el mes en curso (p. ej. el 6 de junio -> junio), en vez de
 * quedarse en el ultimo mes que estuviera guardado.
 *
 * Solo actua UNA vez por sesion: despues, el usuario puede navegar a otros
 * meses con normalidad sin que se lo reseteemos.
 */

import { useEffect, useRef } from "react";
import { useSettings } from "@/hooks/useSettings";

export function CurrentPeriodSync() {
  const { settings, update } = useSettings();
  const done = useRef(false);

  useEffect(() => {
    if (!settings || done.current) return;
    const now = new Date();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();
    if (settings.mesActual === mes && settings.anioActual === anio) {
      done.current = true;
      return;
    }
    done.current = true;
    update({ mesActual: mes, anioActual: anio }).catch(() => {
      done.current = false; // reintentar si fallo
    });
  }, [settings, update]);

  return null;
}
