"use client";

/**
 * src/components/layout/SidebarFooterHints.tsx
 *
 * Componente pequeno con dos botones al pie del sidebar:
 *   - "Buscar..." con Ctrl+K visible (abre la paleta)
 *   - "Atajos" con Ctrl+/ visible (abre la ayuda)
 *
 * Uso opcional. Para activarlo, anade <SidebarFooterHints /> dentro del
 * <Sidebar> al final, en AppSidebar.tsx.
 *
 * IMPLEMENTACION
 * --------------
 * Como los modales estan en ShortcutsProvider y no exponemos su estado
 * via context, este componente DISPARA los atajos sinteticamente con
 * KeyboardEvent. Es un truco perfectamente valido y mantiene
 * ShortcutsProvider sin dependencias circulares.
 */

import { Command, Keyboard, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthProvider";

function triggerShortcut(key: string, ctrl = true) {
  // Emulamos una pulsacion real para que ShortcutsProvider la pille.
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: ctrl,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

export function SidebarFooterHints() {
  const { user, logout } = useAuth();

  return (
    <div className="mt-auto border-t border-sidebar-border p-2 space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between font-normal"
        onClick={() => triggerShortcut("k")}
      >
        <span className="flex items-center gap-2">
          <Command className="h-3.5 w-3.5" />
          Buscar / acciones
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Ctrl+K
        </span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between font-normal"
        onClick={() => triggerShortcut("/")}
      >
        <span className="flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5" />
          Atajos de teclado
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Ctrl+/
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between font-normal"
        onClick={logout}
      >
        <span className="flex items-center gap-2">
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesion
        </span>
        {user && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <UserIcon className="h-3 w-3" />
            {user.username}
          </span>
        )}
      </Button>
    </div>
  );
}
