import type { Metadata } from "next";
import { QueryProvider } from "@/contexts/QueryProvider";
import {
  DatabaseProvider,
  DatabaseReady,
} from "@/contexts/DatabaseProvider";
import { QuickAddProvider } from "@/contexts/QuickAddProvider";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { ShortcutsProvider } from "@/contexts/ShortcutsProvider";
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
 *           ThemeProvider  - Aplica clase 'dark' al <html> segun settings.tema
 *             ShortcutsProvider - Atajos globales: Ctrl+K, Ctrl+/
 *               AppShell   - Sidebar + topbar + FAB
 *                 {children}
 *
 *  QuickAddProvider va DENTRO de DatabaseReady porque internamente usa
 *  el modal QuickExpenseDialog que necesita los repositorios y settings.
 *
 *  ThemeProvider y ShortcutsProvider tambien van dentro de DatabaseReady:
 *  el primero porque lee settings.tema, el segundo porque la CommandPalette
 *  usa useBackup() / useSettings() / useQuickAdd().
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
                <ThemeProvider>
                  <ShortcutsProvider>
                    <AppShell>{children}</AppShell>
                  </ShortcutsProvider>
                </ThemeProvider>
              </QuickAddProvider>
            </DatabaseReady>
          </DatabaseProvider>
          <Toaster richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
