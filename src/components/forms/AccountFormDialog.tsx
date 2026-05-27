"use client";

/**
 * src/components/forms/AccountFormDialog.tsx
 *
 * Dialog modal de crear/editar cuenta. Mismo patron que CategoryFormDialog.
 * Las cuentas pueden tener saldo negativo (tarjetas de credito), asi que
 * el input no fuerza min=0.
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  accountFormSchema,
  type AccountFormData,
  TIPOS_CUENTA,
} from "@/lib/schemas/forms";
import type { Account, Currency } from "@/lib/db/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Account | null;
  monedaLocal: string;
  currencies: Currency[];
  onSubmit: (data: AccountFormData) => Promise<void>;
  loading?: boolean;
};

export function AccountFormDialog({
  open,
  onOpenChange,
  initial,
  monedaLocal,
  currencies,
  onSubmit,
  loading = false,
}: Props) {
  const isEdit = !!initial;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      entidad: "",
      tipo: "Corriente",
      alias: "",
      saldo: 0,
      moneda: monedaLocal,
      activa: true,
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          entidad: initial.entidad,
          tipo: initial.tipo as AccountFormData["tipo"],
          alias: initial.alias,
          saldo: initial.saldo,
          moneda: initial.moneda,
          activa: initial.activa,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          entidad: "",
          tipo: "Corriente",
          alias: "",
          saldo: 0,
          moneda: monedaLocal,
          activa: true,
          notas: "",
        });
      }
    }
  }, [initial, open, monedaLocal, reset]);

  const internalSubmit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch {
      // toast ya disparado
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos de la cuenta."
              : "Anade una cuenta bancaria, broker o de efectivo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entidad">Entidad</Label>
              <Input
                id="entidad"
                {...register("entidad")}
                placeholder="DBS, BBVA, Trade Republic..."
                disabled={loading}
              />
              {errors.entidad && (
                <p className="text-xs text-destructive">{errors.entidad.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo-cuenta">Tipo</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="tipo-cuenta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CUENTA.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Alias</Label>
            <Input
              id="alias"
              {...register("alias")}
              placeholder="Como quieres llamarla (Cuenta corriente principal...)"
              disabled={loading}
            />
            {errors.alias && (
              <p className="text-xs text-destructive">{errors.alias.message}</p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo actual</Label>
              <Input
                id="saldo"
                type="number"
                step="0.01"
                {...register("saldo", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.saldo && (
                <p className="text-xs text-destructive">{errors.saldo.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Puede ser negativo (tarjetas de credito)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="moneda">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="activa" className="flex flex-col gap-1">
              <span>Cuenta activa</span>
              <span className="text-xs font-normal text-muted-foreground">
                Las inactivas no aparecen en selectores
              </span>
            </Label>
            <Controller
              control={control}
              name="activa"
              render={({ field }) => (
                <Switch
                  id="activa"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={loading}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas-cuenta">Notas (opcional)</Label>
            <Textarea
              id="notas-cuenta"
              {...register("notas")}
              rows={2}
              disabled={loading}
            />
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
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
