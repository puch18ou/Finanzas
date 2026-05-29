"use client";

/**
 * ============================================================================
 *  src/contexts/GlobalThemeProvider.tsx — Tema claro/oscuro GLOBAL del PC
 * ============================================================================
 *
 *  El tema NO es por usuario: es una preferencia de toda la maquina. Se guarda
 *  en localStorage (compartido por todos los usuarios de la app en este PC) y
 *  se aplica en TODA la app: login, consola admin y dentro de cada usuario.
 *
 *  Cambiarlo en cualquier sitio (boton de ajustes del login o Ajustes de un
 *  usuario) lo cambia para todos.
 *
 *  Aplica la clase `dark` al <html>; Tailwind v4 + shadcn hacen el resto.
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeValue = "light" | "dark" | "system";

const STORAGE_KEY = "app:theme";

type ThemeContextValue = {
  theme: ThemeValue;
  setTheme: (value: ThemeValue) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useGlobalTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useGlobalTheme debe usarse dentro de <GlobalThemeProvider>.");
  return ctx;
}

function readStored(): ThemeValue {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function applyTheme(theme: ThemeValue): void {
  const root = document.documentElement;
  const effective: "light" | "dark" =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.classList.toggle("dark", effective === "dark");
  root.dataset.theme = effective;
}

export function GlobalThemeProvider({ children }: { children: ReactNode }) {
  // Lectura sincrona en el primer render para evitar el "flash" de tema.
  const [theme, setThemeState] = useState<ThemeValue>(readStored);

  const setTheme = useCallback((value: ThemeValue) => {
    setThemeState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // localStorage no disponible: aplicamos igual, solo no persiste.
    }
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // En modo 'system', seguir los cambios del SO al vuelo.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
