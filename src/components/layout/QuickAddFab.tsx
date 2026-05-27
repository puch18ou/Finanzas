"use client";

/**
 * src/components/layout/QuickAddFab.tsx
 *
 * Boton flotante en la esquina inferior derecha. Visible en todas las
 * paginas. Al pulsarlo abre el modal de anadido rapido.
 *
 * Tambien muestra un tooltip con el atajo de teclado al pasar el raton.
 *
 * Z-index alto (z-50) para superponerse al contenido pero no al modal
 * (que es z-50 tambien pero se renderiza despues en el DOM).
 */

import { Plus } from "lucide-react";
import { useQuickAdd } from "@/contexts/QuickAddProvider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function QuickAddFab() {
  const { open } = useQuickAdd();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={open}
            size="icon"
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
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
