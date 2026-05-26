"use client";

/**
 * ============================================================================
 *  src/components/layout/AppShell.tsx — Layout principal con sidebar
 * ============================================================================
 *
 *  Envuelve toda la app autenticada (en realidad, toda la app, porque
 *  por ahora no hay autenticacion). Compone:
 *
 *    [Sidebar]  [Topbar (trigger + breadcrumb)]
 *               [Contenido de la pagina]
 *
 *  El SidebarProvider de shadcn maneja el estado abierto/cerrado del
 *  sidebar y lo persiste en una cookie (asi recuerda tu preferencia
 *  entre arranques).
 *
 *  El SidebarTrigger es un boton que aparece arriba a la izquierda y
 *  permite plegar/expandir el sidebar. En mobile (que aun no soportamos
 *  pero por si acaso) abre/cierra el panel lateral.
 * ============================================================================
 */

import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {/*
           * En lotes futuros aqui meteremos breadcrumbs dinamicas, selector
           * de mes/anio activo, badge de modo offline, etc.
           */}
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
