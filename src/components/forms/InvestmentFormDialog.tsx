"use client";

/**
 * src/components/forms/InvestmentFormDialog.tsx
 *
 * Dialog modal para crear/editar una inversion. Campos:
 *   - Tipo (Acciones, ETF, Fondo, Cripto, etc.)
 *   - Ticker (opcional)
 *   - Nombre
 *   - Participaciones, precio compra, precio actual, moneda
 *   - Cuenta broker (opcional, filtrada a cuentas tipo "Broker")
 *   - Fecha compra (opcional), notas
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  investmentFormSchema,
  type InvestmentFormData,
  TIPOS_INVERSION,
} from "@/lib/schemas/forms";
import type { Investment, Currency, Account } from "@/lib/db/schema";
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
  initial?: Investment | null;
  currencies: Currency[];
  accounts: Account[];
  monedaLocal: string;
  onSubmit: (data: InvestmentFormData) => Promise<void>;
  loading?: boolean;
};

export function InvestmentFormDialog({
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
    setError,
    formState: { errors },
  } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      tipo: "Acciones",
      ticker: "",
      nombre: "",
      participaciones: 0,
      importeInvertido: 0,
      valorActual: 0,
      moneda: monedaLocal,
      cuentaId: "",
      fechaCompra: null,
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          tipo: initial.tipo,
          ticker: initial.ticker ?? "",
          nombre: initial.nombre,
          participaciones: initial.participaciones,
          importeInvertido: initial.precioCompra * initial.participaciones,
          valorActual: initial.precioActual * initial.participaciones,
          moneda: initial.moneda,
          cuentaId: initial.cuentaId ?? "",
          fechaCompra:
            initial.fechaCompra instanceof Date
              ? initial.fechaCompra
              : initial.fechaCompra
              ? new Date(initial.fechaCompra)
              : null,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          tipo: "Acciones",
          ticker: "",
          nombre: "",
          participaciones: 0,
          importeInvertido: 0,
          valorActual: 0,
          moneda: monedaLocal,
          cuentaId: "",
          fechaCompra: null,
          notas: "",
        });
      }
    }
  }, [initial, open, monedaLocal, reset]);

  const internalSubmit = handleSubmit(async (data) => {
    // Al CREAR, la cuenta de origen y la fecha son obligatorias.
    if (!isEdit && !data.cuentaId) {
      setError("cuentaId", {
        type: "manual",
        message: "Selecciona la cuenta de origen",
      });
      return;
    }
    if (!isEdit && !data.fechaCompra) {
      setError("fechaCompra", {
        type: "manual",
        message: "Selecciona la fecha de compra",
      });
      return;
    }
    try {
      await onSubmit({
        ...data,
        fechaCompra: data.fechaCompra
          ? normalizeDateToUTCNoon(data.fechaCompra)
          : null,
      });
      onOpenChange(false);
    } catch {
      // toast ya mostrado
    }
  });

  // Mostramos todas las cuentas activas (no solo las de tipo "Broker"): la
  // inversion se puede vincular a cualquier cuenta del usuario.
  const cuentasDisponibles = accounts.filter((a) => a.activa);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar inversion" : "Nueva inversion"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos de la inversion."
              : "Anade una posicion (accion, ETF, fondo, cripto...)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="grid grid-cols-[180px_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-tipo">Tipo</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="inv-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_INVERSION.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-ticker">Ticker (opcional)</Label>
              <Input
                id="inv-ticker"
                {...register("ticker")}
                placeholder="AAPL, VWCE, BTC..."
                disabled={loading}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Util para futura integracion con API de cotizaciones
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-nombre">Nombre</Label>
            <Input
              id="inv-nombre"
              {...register("nombre")}
              placeholder="Apple Inc., Vanguard FTSE All-World, Bitcoin..."
              disabled={loading}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          {/* Participaciones y precio de compra: SOLO al crear. Al editar,
              esos valores salen de las aportaciones (no se editan a mano). */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inv-part">Participaciones</Label>
                <Input
                  id="inv-part"
                  type="number"
                  step="0.000001"
                  {...register("participaciones", { valueAsNumber: true })}
                  disabled={loading}
                />
                {errors.participaciones && (
                  <p className="text-xs text-destructive">{errors.participaciones.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-importe">Importe invertido (total)</Label>
                <Input
                  id="inv-importe"
                  type="number"
                  step="0.01"
                  {...register("importeInvertido", { valueAsNumber: true })}
                  disabled={loading}
                />
                {errors.importeInvertido && (
                  <p className="text-xs text-destructive">{errors.importeInvertido.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Valor actual TOTAL (lo que tienes ahora). Solo al editar; al
                crear el valor inicial = importe invertido. */}
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="inv-valor-a">Valor actual (total)</Label>
                <Input
                  id="inv-valor-a"
                  type="number"
                  step="0.01"
                  {...register("valorActual", { valueAsNumber: true })}
                  disabled={loading}
                />
                {errors.valorActual && (
                  <p className="text-xs text-destructive">{errors.valorActual.message}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inv-moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="inv-moneda">
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

          {/* Cuenta de origen y fecha: SOLO al crear (es la compra inicial,
              que descuenta de la cuenta). Al editar no se vuelve a descontar. */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inv-cuenta">Cuenta de origen</Label>
                <Controller
                  control={control}
                  name="cuentaId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={loading}
                    >
                      <SelectTrigger id="inv-cuenta">
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuentasDisponibles.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.alias}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.cuentaId && (
                  <p className="text-xs text-destructive">
                    {errors.cuentaId.message}
                  </p>
                )}
                {cuentasDisponibles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Se descontara el importe (participaciones x precio) de esta
                    cuenta.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No tienes cuentas activas. Crea una en la pagina de Cuentas.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-fecha">Fecha de compra</Label>
                <Controller
                  control={control}
                  name="fechaCompra"
                  render={({ field }) => (
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="inv-fecha"
                          type="button"
                          variant="outline"
                          disabled={loading}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? formatDateLong(field.value, false) : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(d) => {
                            field.onChange(d ?? null);
                            setCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.fechaCompra && (
                  <p className="text-xs text-destructive">
                    {errors.fechaCompra.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="inv-notas">Notas (opcional)</Label>
            <Textarea
              id="inv-notas"
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
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Anadir inversion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
