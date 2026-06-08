"use client";

/**
 * src/components/mobile/MobileScreen.tsx — Marco comun de una pantalla movil.
 * Cabecera pegajosa con titulo + contenido con padding (deja hueco abajo para
 * la barra de pestañas y el boton flotante).
 */

import type { ReactNode } from "react";

export function MobileScreen({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-semibold">{title}</h1>
        {action}
      </div>
      <div className="space-y-4 p-4 pb-28">{children}</div>
    </div>
  );
}
