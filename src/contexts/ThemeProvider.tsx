"use client";

/**
 * ============================================================================
 *  src/contexts/ThemeProvider.tsx — Modo claro/oscuro/sistema
 * ============================================================================
 *
 *  Aplica la clase `dark` al elemento <html> segun el valor de
 *  settings.tema:
 *
 *    - 'light':  nunca pone dark
 *    - 'dark':   siempre pone dark
 *    - 'system': sigue prefers-color-scheme del SO
 *
 *  Tailwind v4 + shadcn detectan la clase `dark` en el <html> y aplican
 *  las CSS variables alternativas (--background, --foreground, etc.).
 *  Todos los componentes shadcn ya usan estas variables, asi que cambian
 *  automaticamente.
 *
 *  IMPLEMENTACION
 *  --------------
 *  - useLayoutEffect en lugar de useEffect para que el cambio se aplique
 *    ANTES del proximo paint, evitando el "flash" de tema incorrecto.
 *  - Listener de matchMedia para responder a cambios del SO en modo
 *    'system' sin tener que recargar.
 *
 *  No expone ningun hook adicional: el tema se cambia desde Ajustes
 *  (settings.tema) y este provider se entera via useSettings().
 * ============================================================================
 */

import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useSettings } from "@/hooks/useSettings";

type ThemeValue = "light" | "dark" | "system";

/**
 * Aplica el tema efectivo al <html>. Si el tema es 'system', resuelve
 * segun matchMedia.
 */
function applyTheme(theme: ThemeValue): void {
  const root = document.documentElement;

  let effective: "light" | "dark";
  if (theme === "system") {
    effective = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    effective = theme;
  }

  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Atributo data-theme por si en el futuro tenemos mas variantes
  // (e.g. tema "ocean", "forest", etc.). Hoy es informativo.
  root.dataset.theme = effective;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const theme: ThemeValue = settings?.tema ?? "system";

  // useLayoutEffect para aplicar ANTES del proximo paint.
  // En SSR no existe (Tauri es CSR puro, asi que no aplica el fallback).
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Escucha cambios del prefers-color-scheme del SO cuando estamos en
  // modo 'system'. Si el usuario cambia el tema del Windows mientras la
  // app esta abierta, lo recogemos al vuelo.
  useEffect(() => {
    if (theme !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");

    // Algunos navegadores antiguos usan addListener en lugar de addEventListener.
    // Chromium (Tauri) soporta addEventListener desde hace tiempo, asi que
    // este es el camino feliz.
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  return <>{children}</>;
}
