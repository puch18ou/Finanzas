"use client";

/**
 * src/components/forms/CurrencyFormDialog.tsx
 *
 * Dialog para crear/editar moneda. Detalles especificos:
 *
 *  - En modo EDITAR, el campo `code` (PK) esta deshabilitado: no puedes
 *    renombrar una moneda porque romperia todas las FK.
 *  - El tipo de cambio se introduce como "1 X = Y MonedaVista". Si la
 *    moneda que editas ES la moneda vista actual, el valor debe ser 1 y
 *    no se puede editar.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { currencyFormSchema, type CurrencyFormData } from "@/lib/schemas/forms";
import type { Currency } from "@/lib/db/schema";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Currency | null;
  monedaVista: string; // codigo de la moneda vista actual
  onSubmit: (data: CurrencyFormData) => Promise<void>;
  loading?: boolean;
};

export function CurrencyFormDialog({
  open,
  onOpenChange,
  initial,
  monedaVista,
  onSubmit,
  loading = false,
}: Props) {
  const isEdit = !!initial;
  const isViewCurrency = initial?.code === monedaVista;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CurrencyFormData>({
    resolver: zodResolver(currencyFormSchema),
    defaultValues: {
      code: "",
      nombre: "",
      simbolo: "",
      tipoCambioVista: 1,
      orden: 999,
      activa: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          code: initial.code,
          nombre: initial.nombre,
          simbolo: initial.simbolo,
          tipoCambioVista: initial.tipoCambioVista,
          orden: initial.orden,
          activa: initial.activa,
        });
      } else {
        reset({
          code: "",
          nombre: "",
          simbolo: "",
          tipoCambioVista: 1,
          orden: 999,
          activa: true,
        });
      }
    }
  }, [initial, open, reset]);

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
          <DialogTitle>{isEdit ? "Editar moneda" : "Nueva moneda"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos de la moneda."
              : "Anade una nueva moneda al catalogo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="code">Codigo</Label>
              <Input
                id="code"
                {...register("code")}
                placeholder="EUR"
                disabled={isEdit || loading}
                className="font-mono uppercase"
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre-moneda">Nombre</Label>
              <Input
                id="nombre-moneda"
                {...register("nombre")}
                placeholder="Euro"
                disabled={loading}
              />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="simbolo">Simbolo</Label>
              <Input
                id="simbolo"
                {...register("simbolo")}
                placeholder="€"
                disabled={loading}
              />
              {errors.simbolo && (
                <p className="text-xs text-destructive">{errors.simbolo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipoCambio">
                1 unidad equivale a (en {monedaVista})
              </Label>
              <Input
                id="tipoCambio"
                type="number"
                step="0.000001"
                {...register("tipoCambioVista", { valueAsNumber: true })}
                disabled={loading || isViewCurrency}
              />
              {errors.tipoCambioVista && (
                <p className="text-xs text-destructive">
                  {errors.tipoCambioVista.message}
                </p>
              )}
              {isViewCurrency && (
                <p className="text-xs text-muted-foreground">
                  Esta es la moneda de visualizacion, siempre vale 1
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="orden">Orden</Label>
              <Input
                id="orden"
                type="number"
                min={0}
                {...register("orden", { valueAsNumber: true })}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Posicion en selectores (menor = arriba)
              </p>
            </div>
            <div className="space-y-2 flex flex-col">
              <Label htmlFor="activa-moneda">Activa</Label>
              <label className="flex items-center gap-2 text-sm h-9">
                <input
                  type="checkbox"
                  id="activa-moneda"
                  {...register("activa")}
                  disabled={loading}
                  className="h-4 w-4"
                />
                Aparece en selectores
              </label>
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
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear moneda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
