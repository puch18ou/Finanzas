"use client";

/**
 * ============================================================================
 *  src/components/auth/AdminConsole.tsx — Consola de administracion
 * ============================================================================
 *
 *  El usuario admin no tiene finanzas: solo gestiona usuarios. Esta consola se
 *  renderiza en lugar de la app normal (sin AppShell ni BD de finanzas).
 *
 *  La gestion completa de usuarios (crear/borrar/resetear PIN) llega en el
 *  Lote 12c. Aqui dejamos la cabecera, el logout y un hueco para la tabla.
 * ============================================================================
 */

import { LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminConsole() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Administracion</span>
            <span className="text-xs text-muted-foreground">
              {user?.username}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios</CardTitle>
            <CardDescription>
              Gestion de usuarios de la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              La gestion de usuarios se anade en el Lote 12c.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
