"use client";

/**
 * ============================================================================
 *  src/contexts/TourProvider.tsx — Tour guiado (ayuda por ventana)
 * ============================================================================
 *
 *  Gestiona el estado del tour interactivo: qué pasos hay activos y en cuál
 *  estamos. Cualquier boton "?" llama a startTour(steps) con los pasos de la
 *  pantalla actual. El render lo hace <Tour /> (montado una vez en el shell).
 *
 *  Es device-local y efimero (no se persiste nada aqui).
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TourStep = {
  /** Selector CSS del elemento a resaltar. Si falta, paso centrado (sin foco). */
  target?: string;
  title: string;
  content: string;
  /** Colocacion preferida de la burbuja respecto al elemento. */
  placement?: "top" | "bottom" | "right" | "auto";
  /**
   * Selector de un elemento que se PULSA (click) justo antes de mostrar el paso.
   * Util para cambiar de pestaña y revelar el `target` (que estara en un panel
   * aun no montado). Los pasos con preClick nunca se descartan al iniciar.
   */
  preClick?: string;
  /**
   * Paso "silencioso": ejecuta su preClick y avanza automaticamente SIN mostrar
   * burbuja. Util para acciones de cierre (p.ej. volver a la pestaña General al
   * terminar) sin explicarlas. title/content pueden ir vacios.
   */
  auto?: boolean;
};

type TourContextValue = {
  steps: TourStep[];
  index: number;
  active: boolean;
  startTour: (steps: TourStep[]) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);

  const startTour = useCallback((s: TourStep[]) => {
    if (!s || s.length === 0) return;
    // Saltamos los pasos cuyo elemento no esta en pantalla ahora mismo (tarjetas
    // que se ocultan hasta que hay datos: avisos, ahorro acumulado, etc.). Los
    // pasos sin target (bienvenida/centrados) siempre se conservan.
    const visible = s.filter(
      (step) =>
        step.preClick ||
        !step.target ||
        document.querySelector(step.target) != null,
    );
    if (visible.length === 0) return;
    setSteps(visible);
    setIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setIndex(0);
    setSteps([]);
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        setActive(false);
        setSteps([]);
        return 0;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ steps, index, active, startTour, next, prev, stop }),
    [steps, index, active, startTour, next, prev, stop],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // Fallback inerte si no hay provider (p.ej. tests o render aislado).
    return {
      steps: [],
      index: 0,
      active: false,
      startTour: () => {},
      next: () => {},
      prev: () => {},
      stop: () => {},
    };
  }
  return ctx;
}
