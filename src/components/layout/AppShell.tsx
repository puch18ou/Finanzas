"use client";

/**
 * src/components/layout/AppShell.tsx — Layout principal con sidebar
 *
 * Igual que antes, pero ahora incluye el QuickAddFab que aparece en todas
 * las paginas.
 */

import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./AppSidebar";
import { QuickAddFab } from "./QuickAddFab";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
      <QuickAddFab />
    </SidebarProvider>
  );
}
