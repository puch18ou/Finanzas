"use client";

/**
 * ============================================================================
 *  src/components/forms/ExpenseFormDialog.tsx
 * ============================================================================
 *
 *  Formulario completo de gasto: fecha (calendar popover), concepto,
 *  categoria, importe + moneda, cuenta (opcional), notas.
 *
 *  Se usa en la pagina /gastos para Anadir y Editar.
 *
 *  COMPONENTE CALENDAR + POPOVER
 *  -----------------------------
 *  shadcn no tiene "DatePicker" como tal. La convencion es combinar:
 *    <Popover>
 *      <PopoverTrigger>
 *        <Button>{value ? format(value) : "Pick date"}</Button>
 *      </PopoverTrigger>
 *      <PopoverContent>
 *        <Calendar selected={value} onSelect={onChange} />
 *      </PopoverContent>
 *    </Popover>
 *
 *  El estado se gestiona via Controller de react-hook-form.
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  expenseFormSchema,
  type ExpenseFormData,
} from "@/lib/schemas/forms";
import type { Expense, Category, Currency, Account } from "@/lib/db/schema";
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

const NONE_VALUE = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Expense | null;
  categories: Category[];
  accounts: Account[];
  currencies: Currency[];
  monedaLocal: string;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  loading?: boolean;
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  accounts,
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
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "",
      categoriaId: "",
      importe: 0,
      moneda: monedaLocal,
      cuentaId: null,
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          fecha: initial.fecha instanceof Date ? initial.fecha : new Date(initial.fecha),
          concepto: initial.concepto,
          categoriaId: initial.categoriaId,
          importe: initial.importe,
          moneda: initial.moneda,
          cuentaId: initial.cuentaId,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          fecha: new Date(),
          concepto: "",
          categoriaId: "",
          importe: 0,
          moneda: monedaLocal,
          cuentaId: null,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos del gasto."
              : "Registra un gasto con todos los detalles."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          {/* Fecha + Importe + Moneda */}
          <div className="grid grid-cols-[1fr_140px_100px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Controller
                control={control}
                name="fecha"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="fecha"
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
              {errors.fecha && (
                <p className="text-xs text-destructive">{errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="importe">Importe</Label>
              <Input
                id="importe"
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
              <Label htmlFor="moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loading}
                  >
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

          {/* Concepto */}
          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto</Label>
            <Input
              id="concepto"
              {...register("concepto")}
              placeholder="Compra semanal, factura luz, cena fuera..."
              disabled={loading}
              autoComplete="off"
            />
            {errors.concepto && (
              <p className="text-xs text-destructive">{errors.concepto.message}</p>
            )}
          </div>

          {/* Categoria + Cuenta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Controller
                control={control}
                name="categoriaId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loading}
                  >
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecciona" />
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
                <p className="text-xs text-destructive">{errors.categoriaId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuenta">Cuenta (opcional)</Label>
              <Controller
                control={control}
                name="cuentaId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE_VALUE ? null : v)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="cuenta">
                      <SelectValue placeholder="Sin cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Sin cuenta</SelectItem>
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
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Anadir gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
