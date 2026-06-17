"use client";

/**
 * src/components/forms/OtherDebtFormDialog.tsx
 *
 * Formulario CRUD para una deuda (prestamo personal, coche, tarjeta, etc.).
 * Schema: { concepto, tipo, importeInicial, capitalPendiente, tin,
 *           plazoRestanteMeses, moneda, fechaInicio?, notas? }
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  otherDebtFormSchema,
  type OtherDebtFormData,
  TIPOS_DEUDA,
} from "@/lib/schemas/forms";
import type { OtherDebt, Currency, Account } from "@/lib/db/schema";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: OtherDebt | null;
  currencies: Currency[];
  accounts: Account[];
  monedaLocal: string;
  onSubmit: (data: OtherDebtFormData) => Promise<void>;
  loading?: boolean;
};

export function OtherDebtFormDialog({
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

  const cuentasActivas = useMemo(
    () => accounts.filter((a) => a.activa),
    [accounts],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OtherDebtFormData>({
    resolver: zodResolver(otherDebtFormSchema),
    defaultValues: {
      concepto: "",
      tipo: "Prestamo personal",
      importeInicial: 0,
      capitalPendiente: 0,
      tin: 0.05,
      plazoRestanteMeses: 60,
      moneda: monedaLocal,
      cuentaPagoId: null,
      fechaInicio: null,
      notas: "",
    },
  });

  const tin = watch("tin");
  const tinPctValue = Number(((tin ?? 0) * 100).toFixed(3));

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          concepto: initial.concepto,
          tipo: initial.tipo,
          importeInicial: initial.importeInicial,
          capitalPendiente: initial.capitalPendiente,
          tin: initial.tin,
          plazoRestanteMeses: initial.plazoRestanteMeses,
          moneda: initial.moneda,
          cuentaPagoId: initial.cuentaPagoId ?? null,
          fechaInicio:
            initial.fechaInicio instanceof Date
              ? initial.fechaInicio
              : initial.fechaInicio
              ? new Date(initial.fechaInicio)
              : null,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          concepto: "",
          tipo: "Prestamo personal",
          importeInicial: 0,
          capitalPendiente: 0,
          tin: 0.05,
          plazoRestanteMeses: 60,
          moneda: monedaLocal,
          cuentaPagoId: null,
          fechaInicio: null,
          notas: "",
        });
      }
    }
  }, [initial, open, monedaLocal, reset]);

  const internalSubmit = handleSubmit(async (data) => {
    try {
      await onSubmit({
        ...data,
        fechaInicio: data.fechaInicio
          ? normalizeDateToUTCNoon(data.fechaInicio)
          : null,
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
          <DialogTitle>{isEdit ? "Editar deuda" : "Nueva deuda"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos del prestamo."
              : "Anade un prestamo personal, coche, tarjeta con cuota, etc."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-concepto">Concepto</Label>
              <Input
                id="d-concepto"
                {...register("concepto")}
                placeholder="Prestamo coche 2024, Estudios master..."
                disabled={loading}
              />
              {errors.concepto && (
                <p className="text-xs text-destructive">{errors.concepto.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-tipo">Tipo</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="d-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DEUDA.map((t) => (
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-imp-inicial">Importe inicial</Label>
              <Input
                id="d-imp-inicial"
                type="number"
                step="100"
                min={0}
                {...register("importeInicial", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.importeInicial && (
                <p className="text-xs text-destructive">{errors.importeInicial.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-capital-p">Capital pendiente</Label>
              <Input
                id="d-capital-p"
                type="number"
                step="100"
                min={0}
                {...register("capitalPendiente", { valueAsNumber: true })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="d-moneda">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-tin">TIN anual (%)</Label>
              <Input
                id="d-tin"
                type="number"
                step="0.01"
                min={0}
                value={tinPctValue}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  setValue("tin", isNaN(pct) ? 0 : pct / 100, { shouldValidate: true });
                }}
                disabled={loading}
              />
              {errors.tin && (
                <p className="text-xs text-destructive">{errors.tin.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-plazo">Plazo restante (meses)</Label>
              <Input
                id="d-plazo"
                type="number"
                step="1"
                min={0}
                {...register("plazoRestanteMeses", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.plazoRestanteMeses && (
                <p className="text-xs text-destructive">{errors.plazoRestanteMeses.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-cuenta-pago">Cuenta de pago</Label>
              <Controller
                control={control}
                name="cuentaPagoId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? null : v)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="d-cuenta-pago">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin asignar</SelectItem>
                      {cuentasActivas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.alias}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                La cuota mensual saldra de esta cuenta como movimiento automatico.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-fecha">Fecha inicio (opcional)</Label>
              <Controller
                control={control}
                name="fechaInicio"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="d-fecha"
                        type="button"
                        variant="outline"
                        disabled={loading}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? formatDateLong(field.value, false) : "Sin fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(d) => {
                          // Mediodia UTC del dia elegido (solo importa el dia).
                          field.onChange(d ? normalizeDateToUTCNoon(d) : null);
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-notas">Notas (opcional)</Label>
            <Textarea
              id="d-notas"
              rows={1}
              {...register("notas")}
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Anadir deuda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
