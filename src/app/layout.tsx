import type { Metadata } from "next";
import { QueryProvider } from "@/contexts/QueryProvider";
import {
  DatabaseProvider,
  DatabaseReady,
} from "@/contexts/DatabaseProvider";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Aplicacion personal de finanzas",
};

/*
 * Orden de los providers (de fuera hacia dentro):
 *
 *   QueryProvider          - TanStack Query, debe envolver todo lo que use queries
 *     DatabaseProvider     - Conexion BD, expone status via context
 *       DatabaseReady      - Bloquea hijos hasta que BD este lista
 *         AppShell         - Sidebar + topbar
 *           {children}     - Cada pagina especifica
 *
 * AppShell usa hooks (usePathname) que requieren estar dentro del cliente,
 * por eso ya esta marcado "use client" en su propio fichero.
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
        </QueryProvider>
      </body>
    </html>
  );
}
