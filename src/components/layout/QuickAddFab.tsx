"use client";

/**
 * src/components/layout/QuickAddFab.tsx
 *
 * Boton flotante en la esquina inferior derecha.
 *
 * - Se puede deshabilitar desde Ajustes (settings.mostrarFab).
 * - Cuando esta visible es semi-transparente para no estorbar la lectura
 *   de la pagina. Al pasar el raton se vuelve opaco.
 */

import { Plus } from "lucide-react";
import { useQuickAdd } from "@/contexts/QuickAddProvider";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function QuickAddFab() {
  const { open } = useQuickAdd();
  const { settings } = useSettings();

  // Si el usuario lo desactivo en Ajustes, no renderizamos nada.
  // El atajo Ctrl+Shift+G sigue funcionando (vive en QuickAddProvider).
  if (settings && !settings.mostrarFab) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={open}
            size="icon"
            className="
              fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg
              opacity-40 hover:opacity-100 focus-visible:opacity-100
              transition-opacity duration-200
            "
            aria-label="Anadir gasto rapido"
          >
            <Plus className="!h-6 !w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <span className="text-xs">
            Anadir gasto rapido{" "}
            <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              Ctrl+Shift+G
            </kbd>
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
