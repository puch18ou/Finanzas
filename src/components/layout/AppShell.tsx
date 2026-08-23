"use client";

/**
 * src/components/layout/AppShell.tsx — Layout principal con sidebar
 *
 * Igual que antes, pero ahora incluye el QuickAddFab que aparece en todas
 * las paginas.
 */

import { useState, type ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./AppSidebar";
import { QuickAddFab } from "./QuickAddFab";
import { MobileApp } from "@/components/mobile/MobileApp";
import { HelpButton } from "@/components/help/HelpButton";
import { Tour } from "@/components/help/Tour";
import { isMobileApp } from "@/lib/utils/platform";

export function AppShell({ children }: { children: ReactNode }) {
  // En movil mostramos la UI propia de pestañas (no el sidebar de escritorio).
  const [mobile] = useState(isMobileApp);
  if (mobile) return <MobileApp />;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* pt = zona segura (barra de estado del movil) para que el boton no
            quede bajo la hora/bateria. En escritorio env(...) vale 0. */}
        <header
          className="shrink-0 border-b"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <HelpButton className="ml-auto" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
      <QuickAddFab />
      <Tour />
    </SidebarProvider>
  );
}
