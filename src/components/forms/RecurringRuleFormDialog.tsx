"use client";

/**
 * src/components/forms/RecurringRuleFormDialog.tsx
 *
 * Lote 11c-fix2: las fechas seleccionadas en el calendario se normalizan
 * a mediodia UTC antes de enviarse al backend. Esto evita el bug de zonas
 * horarias en el que al seleccionar "1 mayo" en hora local Singapur
 * (UTC+8) se guardaba como "30 abril 16:00 UTC", haciendo que el
 * RecurringService interpretara la regla como iniciada en abril.
 *
 * La normalizacion se hace SOLO al enviar al backend; en el form sigue
 * mostrandose la fecha que selecciono el usuario.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  recurringRuleFormSchema,
  parseDiasDelMesInput,
  TIPOS_REGLA_MANUAL,
  type RecurringRuleFormData,
  type TipoReglaManual,
  type FrecuenciaRegla,
} from "@/lib/schemas/forms-recurring";
import type { Currency, Account, Category, RecurringRule } from "@/lib/db/schema";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDateLong, normalizeDateToUTCNoon } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RecurringRule | null;
  currencies: Currency[];
  accounts: Account[];
  categories: Category[];
  monedaLocal: string;
  loading: boolean;
  onSubmit: (data: RecurringRuleFormData) => Promise<void>;
};

const TIPO_LABELS: Record<TipoReglaManual, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia: "Transferencia",
};

const FRECUENCIA_LABELS: Record<FrecuenciaRegla, string> = {
  diaria: "Diaria",
  semanal: "Semanal",
  mensual: "Mensual (un dia)",
  anual: "Anual",
  "varios-mes": "Varios dias al mes",
};

const FRECUENCIAS_ORDEN: FrecuenciaRegla[] = [
  "mensual",
  "varios-mes",
  "semanal",
  "anual",
  "diaria",
];

// 0=domingo..6=sabado (convencion getUTCDay). Mostramos de lunes a domingo.
const DIAS_SEMANA: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

const MESES: Array<{ value: number; label: string }> = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export function RecurringRuleFormDialog({
  open,
  onOpenChange,
  initial,
  currencies,
  accounts,
  categories,
  monedaLocal,
  loading,
  onSubmit,
}: Props) {
  const [calInicioOpen, setCalInicioOpen] = useState(false);
  const [calFinOpen, setCalFinOpen] = useState(false);

  const today = new Date();

  const cuentasActivas = useMemo(
    () => accounts.filter((a) => a.activa),
    [accounts],
  );

  // Todas las categorias son de gasto (sus tipos son "Esencial", "Ocio",
  // etc., no "gasto"). El antiguo filtro c.tipo === "gasto" dejaba el
  // selector vacio.
  const categoriasGasto = categories;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<RecurringRuleFormData>({
    resolver: zodResolver(recurringRuleFormSchema),
    defaultValues: {
      nombre: "",
      tipoMovimiento: "gasto",
      importe: 0,
      moneda: monedaLocal,
      cuentaOrigenId: null,
      cuentaDestinoId: null,
      categoriaId: null,
      categoriaTexto: null,
      diaDelMes: 1,
      frecuencia: "mensual",
      diaSemana: 1,
      diasDelMes: "",
      mesDelAnio: today.getMonth() + 1,
      fechaInicio: normalizeDateToUTCNoon(
        new Date(today.getFullYear(), today.getMonth(), 1),
      ),
      fechaFin: null,
      activa: true,
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          nombre: initial.nombre,
          tipoMovimiento: initial.tipoMovimiento as TipoReglaManual,
          importe: initial.importe,
          moneda: initial.moneda,
          cuentaOrigenId: initial.cuentaOrigenId,
          cuentaDestinoId: initial.cuentaDestinoId,
          categoriaId: initial.categoriaId,
          categoriaTexto: initial.categoriaTexto,
          diaDelMes: initial.diaDelMes,
          frecuencia: (initial.frecuencia ?? "mensual") as FrecuenciaRegla,
          diaSemana: initial.diaSemana ?? 1,
          diasDelMes: initial.diasDelMes ?? "",
          mesDelAnio: initial.mesDelAnio ?? today.getMonth() + 1,
          fechaInicio:
            initial.fechaInicio instanceof Date
              ? initial.fechaInicio
              : new Date(initial.fechaInicio),
          fechaFin: initial.fechaFin
            ? initial.fechaFin instanceof Date
              ? initial.fechaFin
              : new Date(initial.fechaFin)
            : null,
          activa: initial.activa,
          notas: initial.notas ?? "",
        });
      } else {
        reset({
          nombre: "",
          tipoMovimiento: "gasto",
          importe: 0,
          moneda: monedaLocal,
          cuentaOrigenId: null,
          cuentaDestinoId: null,
          categoriaId: null,
          categoriaTexto: null,
          diaDelMes: 1,
          frecuencia: "mensual",
          diaSemana: 1,
          diasDelMes: "",
          mesDelAnio: today.getMonth() + 1,
          fechaInicio: normalizeDateToUTCNoon(
        new Date(today.getFullYear(), today.getMonth(), 1),
      ),
          fechaFin: null,
          activa: true,
          notas: "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, monedaLocal]);

  const tipo = watch("tipoMovimiento");
  const frecuencia = watch("frecuencia");

  const internalSubmit = handleSubmit(async (data) => {
    // Solo persistimos los campos de periodicidad relevantes a la frecuencia,
    // limpiando el resto para no dejar valores obsoletos de otra seleccion.
    const diasNormalizados =
      data.frecuencia === "varios-mes"
        ? (parseDiasDelMesInput(data.diasDelMes ?? "") ?? []).join(",")
        : null;

    // FIX zona horaria: normalizar fechas a mediodia UTC antes de guardar
    const normalized: RecurringRuleFormData = {
      ...data,
      diaSemana: data.frecuencia === "semanal" ? (data.diaSemana ?? 1) : null,
      mesDelAnio: data.frecuencia === "anual" ? (data.mesDelAnio ?? null) : null,
      diasDelMes: diasNormalizados,
      fechaInicio: normalizeDateToUTCNoon(data.fechaInicio),
      fechaFin: data.fechaFin ? normalizeDateToUTCNoon(data.fechaFin) : null,
    };
    await onSubmit(normalized);
    onOpenChange(false);
  });

  const erroresKeys = Object.keys(errors);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar regla recurrente" : "Nueva regla recurrente"}
          </DialogTitle>
          <DialogDescription>
            Las reglas activas generan movimientos automaticamente segun su
            frecuencia, desde su fecha de inicio.
          </DialogDescription>
        </DialogHeader>

        {erroresKeys.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive mb-1">
              Revisa los campos:
            </p>
            <ul className="text-xs text-destructive/80 space-y-0.5">
              {erroresKeys.map((k) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const err = (errors as any)[k];
                return (
                  <li key={k}>
                    <strong>{k}</strong>: {err?.message ?? "valor invalido"}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <form onSubmit={internalSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="r-nombre">Nombre</Label>
            <Input
              id="r-nombre"
              {...register("nombre")}
              placeholder="Salario, Alquiler, Netflix..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Controller
                control={control}
                name="tipoMovimiento"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_REGLA_MANUAL.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPO_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Controller
                control={control}
                name="frecuencia"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FRECUENCIAS_ORDEN.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FRECUENCIA_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Campos de periodicidad segun la frecuencia elegida. */}
          {frecuencia === "mensual" && (
            <div className="space-y-2">
              <Label htmlFor="r-dia">Dia del mes</Label>
              <Input
                id="r-dia"
                type="number"
                min={1}
                max={31}
                {...register("diaDelMes", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Si el mes no tiene ese dia (e.g. 31 en feb), usa el ultimo.
              </p>
            </div>
          )}

          {frecuencia === "varios-mes" && (
            <div className="space-y-2">
              <Label htmlFor="r-dias">Dias del mes</Label>
              <Input
                id="r-dias"
                {...register("diasDelMes")}
                placeholder="1,15"
              />
              <p className="text-xs text-muted-foreground">
                Dias separados por comas (ej. 1,15). Se repite en cada uno; si el
                mes no tiene ese dia, usa el ultimo.
              </p>
            </div>
          )}

          {frecuencia === "semanal" && (
            <div className="space-y-2">
              <Label>Dia de la semana</Label>
              <Controller
                control={control}
                name="diaSemana"
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : ""}
                    onValueChange={(v) => v && field.onChange(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Se repite cada semana ese dia, desde la fecha de inicio.
              </p>
            </div>
          )}

          {frecuencia === "anual" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Controller
                  control={control}
                  name="mesDelAnio"
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : ""}
                      onValueChange={(v) => v && field.onChange(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-dia-anual">Dia</Label>
                <Input
                  id="r-dia-anual"
                  type="number"
                  min={1}
                  max={31}
                  {...register("diaDelMes", { valueAsNumber: true })}
                />
              </div>
            </div>
          )}

          {frecuencia === "diaria" && (
            <p className="text-xs text-muted-foreground rounded-md border p-2">
              Se genera un movimiento cada dia dentro del rango de fechas. Ojo:
              puede crear muchos movimientos.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="r-importe">Importe</Label>
              <Input
                id="r-importe"
                type="number"
                step="0.01"
                min={0}
                {...register("importe", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
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

          {tipo === "gasto" && (
            <>
              <div className="space-y-2">
                <Label>Cuenta origen</Label>
                <Controller
                  control={control}
                  name="cuentaOrigenId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cuenta" />
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
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Controller
                  control={control}
                  name="categoriaId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasGasto.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          {tipo === "ingreso" && (
            <>
              <div className="space-y-2">
                <Label>Cuenta destino (opcional)</Label>
                <Controller
                  control={control}
                  name="cuentaDestinoId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) =>
                        field.onChange(v === "__none__" ? null : v)
                      }
                    >
                      <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-cat-texto">Categoria (texto libre)</Label>
                <Input
                  id="r-cat-texto"
                  {...register("categoriaTexto")}
                  placeholder="Salario, Bonus, Premio, Devolucion..."
                />
              </div>
            </>
          )}

          {tipo === "transferencia" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Origen</Label>
                <Controller
                  control={control}
                  name="cuentaOrigenId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cuenta origen" />
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
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Controller
                  control={control}
                  name="cuentaDestinoId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cuenta destino" />
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
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Controller
                control={control}
                name="fechaInicio"
                render={({ field }) => (
                  <Popover open={calInicioOpen} onOpenChange={setCalInicioOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
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
                            setCalInicioOpen(false);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha fin (opcional)</Label>
              <Controller
                control={control}
                name="fechaFin"
                render={({ field }) => (
                  <Popover open={calFinOpen} onOpenChange={setCalFinOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? formatDateLong(field.value, false)
                          : "Indefinido"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-2 border-b">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            field.onChange(null);
                            setCalFinOpen(false);
                          }}
                        >
                          Sin fecha fin (indefinido)
                        </Button>
                      </div>
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(d) => {
                          if (d) {
                            // Mediodia UTC del dia elegido (solo importa el dia).
                            field.onChange(normalizeDateToUTCNoon(d));
                            setCalFinOpen(false);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border p-2">
            <Controller
              control={control}
              name="activa"
              render={({ field }) => (
                <Switch
                  id="r-activa"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="r-activa" className="cursor-pointer text-sm">
              Regla activa (generará movimientos automáticamente)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} {...register("notas")} />
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
              {loading ? "Guardando..." : initial ? "Guardar cambios" : "Crear regla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
