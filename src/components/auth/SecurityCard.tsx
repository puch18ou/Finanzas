"use client";

/**
 * ============================================================================
 *  src/components/auth/SecurityCard.tsx — Cambiar el PIN propio (en Ajustes)
 * ============================================================================
 *
 *  Permite al usuario en sesion cambiar su propio PIN: verifica el PIN actual
 *  y, si es correcto, guarda el nuevo. El admin tambien puede cambiar el suyo
 *  desde aqui... salvo que entre por la consola admin (que no monta Ajustes);
 *  en la practica lo usan los usuarios normales.
 * ============================================================================
 */

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthProvider";
import { verifyLogin, updatePin } from "@/lib/auth/registry";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PIN = 4;
const MAX_PIN = 8;
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, MAX_PIN);

export function SecurityCard() {
  const { user } = useAuth();
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (nuevo.length < MIN_PIN) {
      setError("El PIN nuevo debe tener entre 4 y 8 digitos.");
      return;
    }
    if (nuevo !== repetir) {
      setError("El PIN nuevo y su repeticion no coinciden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ok = await verifyLogin(user.username, actual);
      if (!ok) {
        setError("El PIN actual no es correcto.");
        return;
      }
      await updatePin(user.id, nuevo);
      setActual("");
      setNuevo("");
      setRepetir("");
      toast.success("PIN actualizado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Seguridad
        </CardTitle>
        <CardDescription>Cambia tu PIN de acceso ({user.username}).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pin-actual">PIN actual</Label>
            <Input
              id="pin-actual"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={actual}
              maxLength={MAX_PIN}
              onChange={(e) => {
                setActual(onlyDigits(e.target.value));
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin-nuevo">PIN nuevo</Label>
            <Input
              id="pin-nuevo"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={nuevo}
              maxLength={MAX_PIN}
              onChange={(e) => {
                setNuevo(onlyDigits(e.target.value));
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin-repetir">Repite el PIN nuevo</Label>
            <Input
              id="pin-repetir"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={repetir}
              maxLength={MAX_PIN}
              onChange={(e) => {
                setRepetir(onlyDigits(e.target.value));
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={
              actual.length < MIN_PIN ||
              nuevo.length < MIN_PIN ||
              repetir.length < MIN_PIN ||
              saving
            }
          >
            {saving ? "Guardando..." : "Cambiar PIN"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
