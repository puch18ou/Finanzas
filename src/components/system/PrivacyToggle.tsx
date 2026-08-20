"use client";

/**
 * src/components/system/PrivacyToggle.tsx — Ojo para activar/ocultar importes.
 */

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/contexts/PrivacyProvider";
import { Button } from "@/components/ui/button";

export function PrivacyToggle({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={hidden ? "Mostrar importes" : "Ocultar importes"}
      title={hidden ? "Mostrar importes" : "Ocultar importes"}
      className={className}
    >
      {hidden ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  );
}
