import type { Metadata } from "next";
import { QueryProvider } from "@/contexts/QueryProvider";
import {
  DatabaseProvider,
  DatabaseReady,
} from "@/contexts/DatabaseProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Aplicacion personal de finanzas",
};

/*
 * Orden de los providers (de fuera hacia dentro):
 *
 *   QueryProvider          - TanStack Query
 *     DatabaseProvider     - Conexion BD
 *       DatabaseReady      - Bloquea hijos hasta que BD este lista
 *         AppShell         - Sidebar + topbar
 *           {children}     - Cada pagina
 *
 * Toaster (Sonner) va al final, fuera del DatabaseReady, para que pueda
 * mostrar errores INCLUSO si la BD no ha cargado.
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
              <AppShell>{children}</AppShell>
            </DatabaseReady>
          </DatabaseProvider>
          <Toaster richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
