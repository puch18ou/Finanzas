"use client";

/**
 * ============================================================================
 *  src/components/auth/LoginScreen.tsx — Pantalla de login / alta de usuario
 * ============================================================================
 *
 *  Dos modos en la misma tarjeta:
 *    - 'login':    usuario + PIN (no mostramos la lista de usuarios por privacidad).
 *    - 'register': alta de un usuario nuevo (rol normal) SIN pasar por el admin.
 *                  Tras crearlo, inicia sesion automaticamente.
 *
 *  Arriba a la derecha hay un boton de ajustes que controla el TEMA GLOBAL del
 *  equipo (claro/oscuro/sistema), compartido por todos los usuarios del PC.
 * ============================================================================
 */

import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { createUser } from "@/lib/auth/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, MAX_PIN);

function rememberUser(username: string) {
  try {
    window.localStorage.setItem(LAST_USER_KEY, username);
  } catch {
    // sin persistencia del ultimo usuario; no es critico
  }
}

type Mode = "login" | "register";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Finanzas</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Inicia sesion para continuar"
                : "Crea un usuario nuevo"}
            </CardDescription>
          </div>
          <SettingsMenu />
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <LoginForm onSwitch={() => setMode("register")} />
          ) : (
            <RegisterForm onSwitch={() => setMode("login")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem(LAST_USER_KEY) ?? "")
      : "",
  );
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    username.trim().length > 0 && pin.length >= MIN_PIN && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await login(username.trim(), pin, remember);
    setSubmitting(false);
    if (result.ok) {
      rememberUser(username.trim());
    } else {
      setError(result.error ?? "No se pudo iniciar sesion.");
      setPin("");
    }
  }

  return (
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
            setPin(onlyDigits(e.target.value));
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
        />
        Mantener sesion iniciada
      </label>

      <Button type="submit" className="w-full gap-2" disabled={!canSubmit}>
        <LogIn className="h-4 w-4" />
        {submitting ? "Entrando..." : "Entrar"}
      </Button>

      <button
        type="button"
        onClick={onSwitch}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Crear un usuario nuevo
      </button>
    </form>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { login, refreshUsers } = useAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    username.trim().length > 0 &&
    pin.length >= MIN_PIN &&
    repeat.length >= MIN_PIN &&
    !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (pin !== repeat) {
      setError("Los dos PIN no coinciden.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const name = username.trim();
      await createUser({ username: name, pin, role: "user", mustChangePin: false });
      await refreshUsers();
      // Alta correcta: iniciar sesion automaticamente con el usuario nuevo.
      const result = await login(name, pin);
      if (result.ok) {
        rememberUser(name);
      } else {
        setError(result.error ?? "Usuario creado, pero no se pudo entrar.");
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-username">Usuario</Label>
        <Input
          id="reg-username"
          autoFocus
          autoComplete="off"
          placeholder="nombre de usuario"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-pin">PIN</Label>
        <Input
          id="reg-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN (4-8 digitos)"
          value={pin}
          maxLength={MAX_PIN}
          onChange={(e) => {
            setPin(onlyDigits(e.target.value));
            setError(null);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reg-repeat">Repite el PIN</Label>
        <Input
          id="reg-repeat"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Repite el PIN"
          value={repeat}
          maxLength={MAX_PIN}
          onChange={(e) => {
            setRepeat(onlyDigits(e.target.value));
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full gap-2" disabled={!canSubmit}>
        <UserPlus className="h-4 w-4" />
        {submitting ? "Creando..." : "Crear y entrar"}
      </Button>

      <button
        type="button"
        onClick={onSwitch}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Ya tengo usuario, iniciar sesion
      </button>
    </form>
  );
}
