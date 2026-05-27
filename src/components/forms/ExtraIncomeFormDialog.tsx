"use client";

/**
 * src/components/forms/ExtraIncomeFormDialog.tsx
 *
 * Formulario de ingreso puntual. Muy similar al de gasto pero:
 *  - `categoria` es texto libre (no FK), con sugerencias predefinidas
 *  - El campo `tipo` se rellena automaticamente con "Ingreso extra"
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  extraIncomeFormSchema,
  type ExtraIncomeFormData,
  CATEGORIAS_INGRESO_EXTRA,
} from "@/lib/schemas/forms";
import type { ExtraIncome, Currency } from "@/lib/db/schema";
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
import { formatDateLong } from "@/lib/utils/dates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ExtraIncome | null;
  currencies: Currency[];
  monedaLocal: string;
  onSubmit: (data: ExtraIncomeFormData) => Promise<void>;
  loading?: boolean;
};

export function ExtraIncomeFormDialog({
  open,
  onOpenChange,
  initial,
  currencies,
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
    formState: { errors },
  } = useForm<ExtraIncomeFormData>({
    resolver: zodResolver(extraIncomeFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "",
      categoria: "Bonus",
      tipo: "Ingreso extra",
      importe: 0,
      moneda: monedaLocal,
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          fecha: initial.fecha instanceof Date ? initial.fecha : new Date(initial.fecha),
          concepto: initial.concepto,
          categoria: initial.categoria,
          tipo: initial.tipo,
          importe: initial.importe,
          moneda: initial.moneda,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          fecha: new Date(),
          concepto: "",
          categoria: "Bonus",
          tipo: "Ingreso extra",
          importe: 0,
          moneda: monedaLocal,
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
      // toast ya mostrado
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ingreso" : "Nuevo ingreso puntual"}</DialogTitle>
          <DialogDescription>
            Bonus, premios, regalos, dividendos... ingresos que no son tu salario habitual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_140px_100px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="ei-fecha">Fecha</Label>
              <Controller
                control={control}
                name="fecha"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="ei-fecha"
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
                            field.onChange(d);
                            setCalendarOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-importe">Importe</Label>
              <Input
                id="ei-importe"
                type="number"
                step="0.01"
                min={0}
                {...register("importe", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.importe && (
                <p className="text-xs text-destructive">{errors.importe.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei-moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="ei-moneda">
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

          <div className="space-y-2">
            <Label htmlFor="ei-concepto">Concepto</Label>
            <Input
              id="ei-concepto"
              {...register("concepto")}
              placeholder="Bonus anual, premio loteria, regalo cumpleanos..."
              disabled={loading}
              autoComplete="off"
            />
            {errors.concepto && (
              <p className="text-xs text-destructive">{errors.concepto.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ei-categoria">Categoria</Label>
            <Controller
              control={control}
              name="categoria"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                  <SelectTrigger id="ei-categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_INGRESO_EXTRA.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ei-notas">Notas (opcional)</Label>
            <Textarea
              id="ei-notas"
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Anadir ingreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
