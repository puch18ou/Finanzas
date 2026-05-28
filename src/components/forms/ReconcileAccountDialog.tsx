"use client";

/**
 * src/components/forms/ReconcileAccountDialog.tsx
 *
 * Conciliacion de una cuenta (Lote 10b). Muestra el saldo CALCULADO actual
 * y permite introducir el saldo REAL del banco. Si hay diferencia, al
 * confirmar se crea un movimiento de tipo "ajuste" que la absorbe, de modo
 * que el saldo calculado pase a coincidir con el real (sin tocar el saldo
 * inicial ni los movimientos historicos).
 */

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import type { Account } from "@/lib/db/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/lib/domain/currency";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  saldoActual: number;
  /** Crea el ajuste. Recibe el saldo real introducido por el usuario. */
  onConfirm: (saldoReal: number) => Promise<void>;
  loading?: boolean;
};

export function ReconcileAccountDialog({
  open,
  onOpenChange,
  account,
  saldoActual,
  onConfirm,
  loading = false,
}: Props) {
  const [saldoReal, setSaldoReal] = useState<number>(saldoActual);

  // Cada vez que se abre (o cambia la cuenta), precargamos el saldo real con
  // el calculado, para que la diferencia parta de cero.
  useEffect(() => {
    if (open) setSaldoReal(saldoActual);
  }, [open, saldoActual, account?.id]);

  const moneda = account?.moneda ?? "EUR";
  const diff = Math.round((saldoReal - saldoActual) * 100) / 100;
  const hayDiff = diff !== 0 && !Number.isNaN(diff);

  const handleConfirm = async () => {
    if (!hayDiff) {
      onOpenChange(false);
      return;
    }
    await onConfirm(saldoReal);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Conciliar {account?.alias ?? "cuenta"}
          </DialogTitle>
          <DialogDescription>
            Introduce el saldo real de la cuenta. Si no coincide con el
            calculado, se creara un movimiento de ajuste por la diferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Saldo calculado</span>
            <span className="font-medium tabular-nums">
              {formatAmount(saldoActual, moneda)}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saldo-real">Saldo real ({moneda})</Label>
            <Input
              id="saldo-real"
              type="number"
              step="0.01"
              value={Number.isNaN(saldoReal) ? "" : saldoReal}
              onChange={(e) => setSaldoReal(Number(e.target.value))}
              disabled={loading}
            />
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-sm">
            {hayDiff ? (
              <p>
                Ajuste a crear:{" "}
                <span
                  className={
                    diff > 0
                      ? "font-semibold text-primary tabular-nums"
                      : "font-semibold text-destructive tabular-nums"
                  }
                >
                  {diff > 0 ? "+" : "−"}
                  {formatAmount(Math.abs(diff), moneda)}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                No hay diferencia: el saldo ya esta conciliado.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading || !hayDiff}>
            {loading ? "Guardando..." : "Crear ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
