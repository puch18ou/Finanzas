"use client";

/**
 * ============================================================================
 *  src/hooks/useKeyboardShortcut.ts — Hook para atajos globales
 * ============================================================================
 *
 *  Hook simple para registrar combinaciones tipo Ctrl+K, Ctrl+Shift+G,
 *  Ctrl+/, etc., con manejo correcto de focus.
 *
 *  Comportamiento clave:
 *    - NO dispara si el evento viene de un <input>, <textarea> o
 *      contentEditable, salvo que el atajo lo permita explicitamente.
 *      Esto es para no robar teclas al usuario mientras escribe.
 *
 *  Uso:
 *    useKeyboardShortcut({ key: 'k', ctrl: true }, () => setOpen(true));
 *    useKeyboardShortcut({ key: '/', ctrl: true }, () => showHelp());
 *
 *  Soporta tambien metaKey (Cmd en Mac) ademas de ctrlKey. La opcion
 *  `ctrl: true` cubre ambos por defecto, para que la app funcione bien
 *  en Mac sin tocar nada.
 * ============================================================================
 */

import { useEffect } from "react";

export type KeyCombo = {
  /** La tecla a pulsar (case-insensitive). E.g. 'k', '/', 'Escape' */
  key: string;
  /** Requiere Ctrl (Windows/Linux) o Cmd (Mac) */
  ctrl?: boolean;
  /** Requiere Shift */
  shift?: boolean;
  /** Requiere Alt */
  alt?: boolean;
  /**
   * Si es true, el atajo se dispara incluso cuando el foco esta en un
   * input/textarea. Util para atajos como "Escape" o el propio "Ctrl+K"
   * que debe abrir el palette aunque estes escribiendo en un campo.
   */
  allowInInput?: boolean;
};

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcut(
  combo: KeyCombo,
  handler: (e: KeyboardEvent) => void,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl en Windows/Linux, Meta (Cmd) en Mac
      const wantCtrl = combo.ctrl ?? false;
      const hasCtrl = e.ctrlKey || e.metaKey;
      if (wantCtrl !== hasCtrl) return;

      if ((combo.shift ?? false) !== e.shiftKey) return;
      if ((combo.alt ?? false) !== e.altKey) return;

      if (e.key.toLowerCase() !== combo.key.toLowerCase()) return;

      if (!combo.allowInInput && isEditingTarget(e.target)) return;

      e.preventDefault();
      handler(e);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // La dependencia `handler` debe ser estable. Si no lo es en el caller,
    // recomendamos useCallback. Aqui no lo memorizamos para no engordar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo.key, combo.ctrl, combo.shift, combo.alt, combo.allowInInput]);
}
