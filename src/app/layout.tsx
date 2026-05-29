import type { Metadata } from "next";
import { GlobalThemeProvider } from "@/contexts/GlobalThemeProvider";
import { QueryProvider } from "@/contexts/QueryProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Aplicacion personal de finanzas",
};

/*
 * Orden de providers (multiusuario, Lote 12):
 *
 *   GlobalThemeProvider  - Tema claro/oscuro GLOBAL del equipo (toda la app)
 *     QueryProvider      - TanStack Query (envolvente)
 *       AuthProvider     - Registro de usuarios + sesion (login por PIN)
 *         AuthGate       - Decide: login / consola admin / app de finanzas
 *
 *  AuthGate monta el stack de finanzas (DatabaseProvider, DatabaseReady,
 *  QuickAddProvider, ShortcutsProvider, AppShell) SOLO cuando hay un usuario
 *  normal con sesion iniciada, abriendo SU fichero .db. El tema es global, no
 *  depende del usuario.
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <GlobalThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <AuthGate>{children}</AuthGate>
            </AuthProvider>
            <Toaster richColors closeButton />
          </QueryProvider>
        </GlobalThemeProvider>
      </body>
    </html>
  );
}
