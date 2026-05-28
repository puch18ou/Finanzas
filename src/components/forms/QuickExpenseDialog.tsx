"use client";

/**
 * src/components/forms/QuickExpenseDialog.tsx
 *
 * Gasto rapido (Ctrl+Shift+G). Lote 10a-2: crea un movement tipo gasto.
 * Mantenemos la ruta forms/ para no tener que cambiar el import en
 * QuickAddProvider.
 */

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const quickGastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  concepto: z.string().min(1, "Concepto obligatorio").max(200),
  cuentaOrigenId: z.string().min(1, "Selecciona una cuenta"),
  categoriaId: z.string().min(1, "Selecciona una categoria"),
  importe: z
    .number({ message: "Debe ser un numero" })
    .positive("Debe ser positivo"),
  moneda: z.string().min(2).max(4),
});

type QuickGastoData = z.infer<typeof quickGastoSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickExpenseDialog({ open, onOpenChange }: Props) {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { create, isMutating } = useMovements();

  const cuentasActivas = useMemo(
    () => accounts.filter((a) => a.activa),
    [accounts],
  );

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<QuickGastoData>({
    resolver: zodResolver(quickGastoSchema),
    defaultValues: {
      fecha: todayStr,
      concepto: "",
      cuentaOrigenId: settings?.cuentaPorDefectoId ?? "",
      categoriaId: "",
      importe: 0,
      moneda: settings?.monedaLocal ?? "EUR",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        fecha: todayStr,
        concepto: "",
        cuentaOrigenId: settings?.cuentaPorDefectoId ?? "",
        categoriaId: "",
        importe: 0,
        moneda: settings?.monedaLocal ?? "EUR",
      });
    }
  }, [open, settings, todayStr, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const fecha = new Date(data.fecha + "T12:00:00Z");
    await create({
      tipo: "gasto",
      fecha,
      mes: fecha.getMonth() + 1,
      anio: fecha.getFullYear(),
      concepto: data.concepto,
      importe: data.importe,
      moneda: data.moneda,
      cuentaOrigenId: data.cuentaOrigenId,
      cuentaDestinoId: null,
      categoriaId: data.categoriaId,
      categoriaTexto: null,
      notas: null,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuevo gasto rapido
          </DialogTitle>
          <DialogDescription>
            Registra un gasto rapido. Ctrl+Shift+G para abrir desde cualquier
            pantalla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="q-fecha">Fecha</Label>
              <Input id="q-fecha" type="date" {...register("fecha")} />
              {errors.fecha && (
                <p className="text-xs text-destructive">
                  {errors.fecha.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-importe">Importe</Label>
              <Input
                id="q-importe"
                type="number"
                step="0.01"
                min={0}
                {...register("importe", { valueAsNumber: true })}
              />
              {errors.importe && (
                <p className="text-xs text-destructive">
                  {errors.importe.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-concepto">Concepto</Label>
            <Input
              id="q-concepto"
              {...register("concepto")}
              autoFocus
              placeholder="Cafe, gasolina..."
            />
            {errors.concepto && (
              <p className="text-xs text-destructive">
                {errors.concepto.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Controller
                control={control}
                name="cuentaOrigenId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasActivas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.alias}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cuentaOrigenId && (
                <p className="text-xs text-destructive">
                  {errors.cuentaOrigenId.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Controller
                control={control}
                name="categoriaId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoriaId && (
                <p className="text-xs text-destructive">
                  {errors.categoriaId.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="q-moneda">Moneda</Label>
            <Controller
              control={control}
              name="moneda"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="q-moneda" className="max-w-[140px]">
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isMutating}>
              {isMutating ? "Guardando..." : "Anadir gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
