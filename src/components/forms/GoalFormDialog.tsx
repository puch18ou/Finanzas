"use client";

/**
 * src/components/forms/GoalFormDialog.tsx
 *
 * Dialog modal de crear/editar meta.
 *
 * IMPORTANTE — vinculacion a cuenta:
 * - Si `cuentaVinculadaId` tiene valor, el campo `yaAhorrado` quedara
 *   deshabilitado y se mostrara un mensaje explicando que el progreso
 *   se calcula del saldo de la cuenta automaticamente.
 * - Al desvincular, el campo se vuelve editable de nuevo.
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, Info } from "lucide-react";
import {
  goalFormSchema,
  type GoalFormData,
} from "@/lib/schemas/forms";
import type { Goal, Currency, Account } from "@/lib/db/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils/cn";
import { formatDateLong, normalizeDateToUTCNoon } from "@/lib/utils/dates";

const NONE_VALUE = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Goal | null;
  currencies: Currency[];
  accounts: Account[];
  monedaLocal: string;
  onSubmit: (data: GoalFormData) => Promise<void>;
  loading?: boolean;
};

export function GoalFormDialog({
  open,
  onOpenChange,
  initial,
  currencies,
  accounts,
  monedaLocal,
  onSubmit,
  loading = false,
}: Props) {
  const isEdit = !!initial;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      nombre: "",
      importeObjetivo: 0,
      yaAhorrado: 0,
      moneda: monedaLocal,
      // Fecha objetivo por defecto: dentro de 1 año
      fechaObjetivo: normalizeDateToUTCNoon(
        new Date(
          new Date().getFullYear() + 1,
          new Date().getMonth(),
          new Date().getDate(),
        ),
      ),
      cuentaVinculadaId: null,
      notas: "",
    },
  });

  // Vigilamos el campo cuentaVinculadaId para deshabilitar yaAhorrado
  // cuando esta vinculada.
  const cuentaVinculada = watch("cuentaVinculadaId");
  const isLinked = cuentaVinculada !== null && cuentaVinculada !== undefined && cuentaVinculada !== "";

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          nombre: initial.nombre,
          importeObjetivo: initial.importeObjetivo,
          yaAhorrado: initial.yaAhorrado,
          moneda: initial.moneda,
          fechaObjetivo:
            initial.fechaObjetivo instanceof Date
              ? initial.fechaObjetivo
              : new Date(initial.fechaObjetivo),
          cuentaVinculadaId: initial.cuentaVinculadaId,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          nombre: "",
          importeObjetivo: 0,
          yaAhorrado: 0,
          moneda: monedaLocal,
          fechaObjetivo: new Date(
            new Date().getFullYear() + 1,
            new Date().getMonth(),
            new Date().getDate(),
          ),
          cuentaVinculadaId: null,
          notas: "",
        });
      }
    }
  }, [initial, open, monedaLocal, reset]);

  const internalSubmit = handleSubmit(async (data) => {
    try {
      await onSubmit({
        ...data,
        fechaObjetivo: normalizeDateToUTCNoon(data.fechaObjetivo),
      });
      onOpenChange(false);
    } catch {
      // toast ya mostrado
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar meta" : "Nueva meta de ahorro"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos de la meta."
              : "Define un objetivo de ahorro con su fecha."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="g-nombre">Nombre</Label>
            <Input
              id="g-nombre"
              {...register("nombre")}
              placeholder="Entrada para piso, viaje a Japon..."
              disabled={loading}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          {/* Objetivo + moneda */}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="g-objetivo">Importe objetivo</Label>
              <Input
                id="g-objetivo"
                type="number"
                step="0.01"
                min={0}
                {...register("importeObjetivo", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.importeObjetivo && (
                <p className="text-xs text-destructive">{errors.importeObjetivo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="g-moneda">
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

          {/* Vinculacion a cuenta */}
          <div className="space-y-2">
            <Label htmlFor="g-cuenta">Cuenta vinculada (opcional)</Label>
            <Controller
              control={control}
              name="cuentaVinculadaId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE_VALUE}
                  onValueChange={(v) =>
                    field.onChange(v === NONE_VALUE ? null : v)
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="g-cuenta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      Sin vincular (importe manual)
                    </SelectItem>
                    {accounts
                      .filter((a) => a.activa)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.alias} ({a.moneda})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {isLinked && (
              <p className="flex items-start gap-1.5 rounded-md bg-accent/40 p-2 text-xs text-accent-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Al vincular una cuenta, el progreso se mide segun su saldo
                  actual. El campo "Ya ahorrado" queda en informativo.
                </span>
              </p>
            )}
          </div>

          {/* Ya ahorrado + fecha objetivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="g-ahorrado">
                Ya ahorrado {isLinked && <span className="text-xs text-muted-foreground">(de la cuenta)</span>}
              </Label>
              <Input
                id="g-ahorrado"
                type="number"
                step="0.01"
                min={0}
                {...register("yaAhorrado", { valueAsNumber: true })}
                disabled={loading || isLinked}
              />
              {errors.yaAhorrado && (
                <p className="text-xs text-destructive">{errors.yaAhorrado.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-fecha">Fecha objetivo</Label>
              <Controller
                control={control}
                name="fechaObjetivo"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="g-fecha"
                        type="button"
                        variant="outline"
                        disabled={loading}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? formatDateLong(field.value, false) : "Selecciona"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => {
                          if (d) {
                            // Mediodia UTC del dia elegido (solo importa el dia).
                            field.onChange(normalizeDateToUTCNoon(d));
                            setCalendarOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.fechaObjetivo && (
                <p className="text-xs text-destructive">{errors.fechaObjetivo.message}</p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="g-notas">Notas (opcional)</Label>
            <Textarea
              id="g-notas"
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
