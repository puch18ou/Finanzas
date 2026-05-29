"use client";

/**
 * ============================================================================
 *  src/components/auth/LoginScreen.tsx — Pantalla de login (usuario + PIN)
 * ============================================================================
 *
 *  Formulario clasico de credenciales: escribes el nombre de usuario (p.ej.
 *  admin) y el PIN (4-8 digitos). No mostramos la lista de usuarios
 *  por privacidad.
 *
 *  Arriba a la derecha hay un boton de ajustes que controla el TEMA GLOBAL del
 *  equipo (claro/oscuro/sistema), compartido por todos los usuarios del PC.
 * ============================================================================
 */

import { useState } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsMenu } from "@/components/auth/SettingsMenu";

const MIN_PIN = 4;
const MAX_PIN = 8;
const LAST_USER_KEY = "auth:lastUsername";

export function LoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = useState(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem(LAST_USER_KEY) ?? "")
      : "",
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    username.trim().length > 0 && pin.length >= MIN_PIN && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await login(username.trim(), pin);
    setSubmitting(false);
    if (result.ok) {
      try {
        window.localStorage.setItem(LAST_USER_KEY, username.trim());
      } catch {
        // sin persistencia del ultimo usuario; no es critico
      }
    } else {
      setError(result.error ?? "No se pudo iniciar sesion.");
      setPin("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Finanzas</CardTitle>
            <CardDescription>Inicia sesion para continuar</CardDescription>
          </div>
          <SettingsMenu />
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-username">Usuario</Label>
              <Input
                id="login-username"
                autoFocus
                autoComplete="username"
                placeholder="usuario"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-pin">PIN</Label>
              <Input
                id="login-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="PIN (4-8 digitos)"
                value={pin}
                maxLength={MAX_PIN}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, MAX_PIN));
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!canSubmit}
            >
              <LogIn className="h-4 w-4" />
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
