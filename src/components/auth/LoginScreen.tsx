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
import { LogIn, UserPlus, Wifi } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { createUser } from "@/lib/auth/registry";
import { provisionFromServer, initProvisionedDb } from "@/lib/sync/lan";
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

type Mode = "login" | "register" | "connect";

const DESCRIPTIONS: Record<Mode, string> = {
  login: "Inicia sesion para continuar",
  register: "Crea un usuario nuevo",
  connect: "Trae tu usuario desde el PC por WiFi",
};

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Finanzas</CardTitle>
            <CardDescription>{DESCRIPTIONS[mode]}</CardDescription>
          </div>
          <SettingsMenu />
        </CardHeader>
        <CardContent>
          {mode === "login" && (
            <LoginForm
              onSwitch={() => setMode("register")}
              onConnect={() => setMode("connect")}
            />
          )}
          {mode === "register" && (
            <RegisterForm onSwitch={() => setMode("login")} />
          )}
          {mode === "connect" && (
            <ConnectForm onSwitch={() => setMode("login")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoginForm({
  onSwitch,
  onConnect,
}: {
  onSwitch: () => void;
  onConnect: () => void;
}) {
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

      <button
        type="button"
        onClick={onConnect}
        className="flex w-full items-center justify-center gap-1.5 text-center text-sm text-muted-foreground hover:text-foreground"
      >
        <Wifi className="h-3.5 w-3.5" />
        Conectar con un PC (WiFi)
      </button>
    </form>
  );
}

/**
 * Aprovisionamiento: trae el usuario y sus datos desde el PC (host) por WiFi.
 * Crea el usuario local, vuelca el snapshot en su BD nueva e inicia sesion.
 */
function ConnectForm({ onSwitch }: { onSwitch: () => void }) {
  const { login, refreshUsers } = useAuth();
  const [address, setAddress] = useState(() =>
    typeof window !== "undefined"
      ? (window.localStorage.getItem("sync:serverAddress") ?? "")
      : "",
  );
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    address.trim().length > 0 &&
    username.trim().length > 0 &&
    pin.length >= MIN_PIN &&
    !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const addr = address.trim();
    const name = username.trim();
    try {
      window.localStorage.setItem("sync:serverAddress", addr);
      setStatus("Conectando con el PC…");
      const { user, snapshot } = await provisionFromServer(addr, name, pin);

      setStatus("Creando usuario y volcando datos…");
      const local = await createUser({
        username: name,
        pin,
        role: "user",
        mustChangePin: user.mustChangePin,
      });
      if (!local.dbFile) throw new Error("El usuario no tiene BD de datos.");
      await initProvisionedDb(local.dbFile, snapshot, `lan:${addr}`);
      await refreshUsers();

      setStatus("Iniciando sesion…");
      const result = await login(name, pin);
      if (result.ok) {
        rememberUser(name);
      } else {
        setError(result.error ?? "Datos traidos, pero no se pudo entrar.");
        setSubmitting(false);
      }
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof Error ? err.message : "No se pudo conectar con el PC.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="conn-addr">Direccion del PC</Label>
        <Input
          id="conn-addr"
          autoFocus
          autoComplete="off"
          placeholder="192.168.1.40:8787"
          className="font-mono"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="conn-username">Usuario (el del PC)</Label>
        <Input
          id="conn-username"
          autoComplete="off"
          placeholder="usuario"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="conn-pin">PIN (el del PC)</Label>
        <Input
          id="conn-pin"
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

      {status && !error && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full gap-2" disabled={!canSubmit}>
        <Wifi className="h-4 w-4" />
        {submitting ? "Conectando..." : "Traer del PC y entrar"}
      </Button>

      <button
        type="button"
        onClick={onSwitch}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Volver
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
