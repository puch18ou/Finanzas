import type { Metadata } from "next";
import { QueryProvider } from "@/contexts/QueryProvider";
import {
  DatabaseProvider,
  DatabaseReady,
} from "@/contexts/DatabaseProvider";
import { QuickAddProvider } from "@/contexts/QuickAddProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Aplicacion personal de finanzas",
};

/*
 * Orden de providers:
 *
 *   QueryProvider          - TanStack Query (envolvente)
 *     DatabaseProvider     - Conexion BD
 *       DatabaseReady      - Bloquea hijos hasta que BD este lista
 *         QuickAddProvider - Estado del modal global de anadido rapido
 *           AppShell       - Sidebar + topbar + FAB
 *             {children}   - Cada pagina
 *
 *  QuickAddProvider va DENTRO de DatabaseReady porque internamente usa
 *  el modal QuickExpenseDialog que necesita los repositorios y settings.
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <DatabaseProvider>
            <DatabaseReady>
              <QuickAddProvider>
                <AppShell>{children}</AppShell>
              </QuickAddProvider>
            </DatabaseReady>
          </DatabaseProvider>
          <Toaster richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
