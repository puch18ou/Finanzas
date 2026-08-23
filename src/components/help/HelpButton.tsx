"use client";

/**
 * src/components/help/HelpButton.tsx — Boton "?" que lanza el tour de la pantalla
 *
 * Usa la ruta actual para buscar los pasos del tour y arrancarlo. Si la
 * pantalla no tiene tour definido, no se muestra.
 */

import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/contexts/TourProvider";
import { getTourForRoute, hasTourForRoute } from "@/lib/help/tours";

export function HelpButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const { startTour } = useTour();

  if (!hasTourForRoute(pathname)) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      data-tour="help-button"
      aria-label="Ayuda de esta pantalla"
      title="Ayuda de esta pantalla"
      onClick={() => startTour(getTourForRoute(pathname))}
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
