"use client";

/**
 * ============================================================================
 *  src/contexts/QuickAddProvider.tsx
 * ============================================================================
 *
 *  Provee un mecanismo global para abrir el modal de "anadido rapido"
 *  desde cualquier sitio. Tres entradas posibles:
 *
 *    1. El boton flotante (FAB) que aparece en todas las paginas
 *    2. El atajo de teclado Ctrl+Shift+G (recordando las macros de Excel)
 *    3. Programaticamente, llamando openQuickAdd() desde cualquier componente
 *
 *  El modal en si es <QuickExpenseDialog />, que se monta una sola vez
 *  como parte de este provider para que su estado abierto/cerrado sea
 *  unico en toda la app.
 *
 *  ATAJO DE TECLADO
 *  ----------------
 *  Implementacion via window.addEventListener('keydown', ...). Comprobamos
 *  Ctrl+Shift+G. En Mac la convencion seria Meta+Shift+G (Cmd), pero como
 *  esta es app de escritorio Windows/Linux/Mac via Tauri, capturamos ambas
 *  combinaciones por robustez.
 *
 *  e.preventDefault() en el handler evita que el navegador trate de hacer
 *  algo con la combinacion (Ctrl+Shift+G en Chrome busca en pagina, por ej).
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QuickExpenseDialog } from "@/components/forms/QuickExpenseDialog";

type QuickAddContext = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const Ctx = createContext<QuickAddContext | null>(null);

export function useQuickAdd(): QuickAddContext {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useQuickAdd debe usarse dentro de <QuickAddProvider>");
  }
  return v;
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Atajo global: Ctrl+Shift+G (o Cmd+Shift+G en Mac).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (
        isCtrlOrMeta &&
        e.shiftKey &&
        (e.key === "G" || e.key === "g")
      ) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      {children}
      <QuickExpenseDialog open={isOpen} onOpenChange={setIsOpen} />
    </Ctx.Provider>
  );
}
