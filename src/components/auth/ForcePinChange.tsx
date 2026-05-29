"use client";

/**
 * ============================================================================
 *  src/components/auth/ForcePinChange.tsx — Cambio de PIN obligatorio
 * ============================================================================
 *
 *  Se muestra cuando el usuario en sesion tiene must_change_pin = true: el
 *  admin en su primer login (PIN inicial 0000) o cualquier usuario al que el
 *  admin le haya reseteado el PIN. Obliga a definir un PIN propio antes de
 *  continuar.
 * ============================================================================
 */

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { updatePin } from "@/lib/auth/registry";
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

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, MAX_PIN);

export function ForcePinChange() {
  const { user, setSessionUser } = useAuth();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (pin.length < MIN_PIN) {
      setError("El PIN debe tener entre 4 y 8 digitos.");
      return;
    }
    if (pin !== confirm) {
      setError("Los dos PIN no coinciden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePin(user.id, pin);
      setSessionUser({ ...user, mustChangePin: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el PIN.");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5" /> Define tu PIN
            </CardTitle>
            <CardDescription>
              {user.username}: por seguridad, elige un PIN nuevo (4-8 digitos).
            </CardDescription>
          </div>
          <SettingsMenu />
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pin">Nuevo PIN</Label>
              <Input
                id="new-pin"
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Nuevo PIN"
                value={pin}
                maxLength={MAX_PIN}
                onChange={(e) => {
                  setPin(onlyDigits(e.target.value));
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pin">Repite el PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Repite el PIN"
                value={confirm}
                maxLength={MAX_PIN}
                onChange={(e) => {
                  setConfirm(onlyDigits(e.target.value));
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={pin.length < MIN_PIN || confirm.length < MIN_PIN || saving}
            >
              {saving ? "Guardando..." : "Guardar y continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
