"use client";

/**
 * ============================================================================
 *  src/contexts/ShortcutsProvider.tsx — Coordinador global de atajos
 * ============================================================================
 *
 *  Provider que vive cerca del top de la app y registra los atajos
 *  globales:
 *
 *    - Ctrl+K  → abre la paleta de comandos
 *    - Ctrl+/  → abre el modal de ayuda
 *
 *  Nota: Ctrl+Shift+G (gasto rapido) lo gestiona QuickAddProvider, que
 *  vive a otro nivel por motivos historicos. Lo dejamos como esta — la
 *  responsabilidad se mantiene clara.
 *
 *  Ademas, expone el modal de paleta y el de help como UI persistente
 *  (estan montados aqui, no en cada pagina).
 * ============================================================================
 */

import { useState, type ReactNode } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/help/KeyboardShortcutsDialog";

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Ctrl+K → paleta. allowInInput=true para que tambien abra cuando
  // estas escribiendo en un campo (comportamiento esperado de Ctrl+K).
  useKeyboardShortcut(
    { key: "k", ctrl: true, allowInInput: true },
    () => setPaletteOpen((v) => !v),
  );

  // Ctrl+/ → ayuda. Sin allowInInput porque "/" se usa para slash en
  // forms / urls. Si quieres permitirlo, cambia.
  useKeyboardShortcut({ key: "/", ctrl: true }, () =>
    setHelpOpen((v) => !v),
  );

  return (
    <>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
