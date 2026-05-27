"use client";

/**
 * ============================================================================
 *  src/hooks/useLocalStorage.ts — Hook genérico para state persistente
 * ============================================================================
 *
 *  Wrapper sobre useState que sincroniza con localStorage. Util para
 *  preferencias de UI que NO son datos de negocio (no van a BD, no se
 *  sincronizan entre dispositivos en Fase C).
 *
 *  EJEMPLOS DE USO
 *  ---------------
 *    const [chart, setChart] = useLocalStorage('dashboard:categoriaChart', 'donut');
 *    const [theme, setTheme] = useLocalStorage('app:theme', 'system');
 *
 *  DETALLES TECNICOS
 *  -----------------
 *  - El valor por defecto se usa si localStorage esta vacio o falla.
 *  - Si JSON.parse falla (valor corrupto), volvemos al defecto y log warning.
 *  - Tipo generico: TypeScript infiere el tipo del valor por defecto.
 *
 *  SSR / HIDRATACION
 *  -----------------
 *  En el primer render (servidor o pre-hidratacion), localStorage no existe.
 *  Devolvemos el defecto y leemos localStorage en un useEffect. Esto puede
 *  causar un parpadeo si el valor guardado difiere del defecto, pero en
 *  nuestra app (Tauri, sin SSR real) apenas se nota.
 * ============================================================================
 */

import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  // Al montar, intentamos leer del localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch (err) {
      console.warn(`useLocalStorage: error leyendo '${key}'`, err);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Al cambiar, persistimos.
  const setAndPersist = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(prev)
            : newValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (err) {
          console.warn(`useLocalStorage: error escribiendo '${key}'`, err);
        }
        return next;
      });
    },
    [key],
  );

  // hydrated indica si ya intentamos leer (puede ser util para evitar
  // parpadeos en componentes con SSR; aqui no lo exponemos pero queda
  // disponible si se necesita).
  void hydrated;

  return [value, setAndPersist];
}
