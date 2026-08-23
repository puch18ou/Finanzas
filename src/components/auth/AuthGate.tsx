"use client";

/**
 * ============================================================================
 *  src/components/auth/AuthGate.tsx — Puerta de entrada segun la sesion
 * ============================================================================
 *
 *  Decide que se renderiza segun el estado de auth:
 *    - cargando registro   -> pantalla de carga
 *    - sin sesion          -> LoginScreen
 *    - admin               -> AdminConsole (sin BD de finanzas)
 *    - usuario normal      -> stack de providers + AppShell + paginas
 *
 *  El stack de finanzas (DatabaseProvider...) solo se monta para usuarios
 *  normales, de modo que la BD del usuario se abre tras el login y se cierra
 *  al cerrar sesion (ver AuthProvider.logout).
 * ============================================================================
 */

import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ForcePinChange } from "@/components/auth/ForcePinChange";
import { AdminConsole } from "@/components/auth/AdminConsole";
import {
  DatabaseProvider,
  DatabaseReady,
} from "@/contexts/DatabaseProvider";
import { QuickAddProvider } from "@/contexts/QuickAddProvider";
import { ShortcutsProvider } from "@/contexts/ShortcutsProvider";
import { PrivacyProvider } from "@/contexts/PrivacyProvider";
import { TourProvider } from "@/contexts/TourProvider";
import { DemoProvider } from "@/contexts/DemoProvider";
import { AppShell } from "@/components/layout/AppShell";
import { MarketAutoRefresh } from "@/components/fx/MarketAutoRefresh";
import { PatrimonioSnapshotTaker } from "@/components/patrimonio/PatrimonioSnapshotTaker";
import { AutoBackupRunner } from "@/components/backup/AutoBackupRunner";
import { SyncServerHandler } from "@/components/sync/SyncServerHandler";
import { AutoSync } from "@/components/sync/AutoSync";
import { UpdateChecker } from "@/components/system/UpdateChecker";
import { MobileUpdateChecker } from "@/components/system/MobileUpdateChecker";

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, error, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">
            Error cargando el registro de usuarios
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-destructive/80">
            {error.message}
          </pre>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (user.mustChangePin) {
    return <ForcePinChange />;
  }

  if (user.role === "admin") {
    return <AdminConsole />;
  }

  return (
    <DatabaseProvider>
      <DatabaseReady>
        <MarketAutoRefresh />
        <PatrimonioSnapshotTaker />
        <AutoBackupRunner />
        <SyncServerHandler />
        <AutoSync />
        <UpdateChecker />
        <MobileUpdateChecker />
        <PrivacyProvider>
          <TourProvider>
            <DemoProvider>
              <QuickAddProvider>
                <ShortcutsProvider>
                  <AppShell>{children}</AppShell>
                </ShortcutsProvider>
              </QuickAddProvider>
            </DemoProvider>
          </TourProvider>
        </PrivacyProvider>
      </DatabaseReady>
    </DatabaseProvider>
  );
}
