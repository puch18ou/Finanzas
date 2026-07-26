"use client";
import { useEffect, useState } from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { isMobileApp } from "@/lib/utils/platform";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // En el movil los avisos salen ABAJO por defecto, justo donde estan las
  // pestañas de la app y la barra de botones de Android (atras/home), que los
  // tapan y hacen dificil pulsar acciones como "Descargar" del aviso de nueva
  // version. Los movemos ARRIBA (bajo la barra de estado) en movil.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => setIsMobile(isMobileApp()), []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={isMobile ? "top-center" : undefined}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
