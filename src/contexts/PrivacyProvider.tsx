"use client";

/**
 * src/contexts/PrivacyProvider.tsx — "Modo privacidad" (ocultar importes).
 *
 * Un unico interruptor GLOBAL que enmascara todos los importes de dinero de la
 * app (patrimonio, cuentas, inversiones, ingresos/gastos, presupuestos,
 * graficas...). Se mantienen porcentajes, nombres, fechas y contadores.
 *
 * Es DEVICE-LOCAL (no se sincroniza): tiene sentido ocultar en el movil sin
 * afectar al PC. Se guarda en localStorage y sobrevive reinicios.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { maskMoney } from "@/lib/utils/privacy";

const STORAGE_KEY = "finanzas.privacy.hidden";

type PrivacyCtx = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
};

const Ctx = createContext<PrivacyCtx | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  // Cargar el valor guardado al montar (localStorage no existe en SSR).
  useEffect(() => {
    try {
      setHiddenState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // sin localStorage: quedamos en visible
    }
  }, []);

  const persist = (v: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignoramos
    }
  };

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    persist(v);
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const v = !prev;
      persist(v);
      return v;
    });
  }, []);

  return (
    <Ctx.Provider value={{ hidden, toggle, setHidden }}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * Estado del modo privacidad. Si se usa fuera del provider devuelve un valor
 * seguro (visible) para no romper nada.
 */
export function usePrivacy(): PrivacyCtx {
  return (
    useContext(Ctx) ?? {
      hidden: false,
      toggle: () => {},
      setHidden: () => {},
    }
  );
}

/**
 * Devuelve una funcion que enmascara un importe YA formateado cuando el modo
 * privacidad esta activo. Aplicar SOLO a la parte de dinero (no a cadenas con
 * porcentajes u otro texto): `mask(formatAmount(x, cur))`.
 */
export function useMaskMoney(): (formatted: string) => string {
  const { hidden } = usePrivacy();
  return useCallback(
    (formatted: string) => (hidden ? maskMoney(formatted) : formatted),
    [hidden],
  );
}
