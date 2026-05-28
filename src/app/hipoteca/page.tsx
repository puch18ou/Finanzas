"use client";

/**
 * src/app/hipoteca/page.tsx
 *
 * Lote 11c-fix: añade selector de cuenta de pago.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar as CalendarIcon,
  Home,
  TrendingUp,
  Calculator,
  ChevronRight,
  ChevronDown,
  Save,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useMortgage } from "@/hooks/useMortgage";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccounts } from "@/hooks/useAccounts";
import {
  mortgageFormSchema,
  type MortgageFormData,
  TIPOS_HIPOTECA,
} from "@/lib/schemas/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AmortizationChart } from "@/components/charts/AmortizationChart";
import {
  buildAmortizationTable,
  buildAnnualSummary,
  summarizeMortgage,
  type AnnualSummaryRow,
} from "@/lib/domain/mortgage";
import { formatAmount } from "@/lib/domain/currency";
import { formatDateLong, normalizeDateToUTCNoon } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export default function HipotecaPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { mortgage, upsert, clear, isMutating } = useMortgage();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const monedaPorDefecto =
    settings?.monedaHipoteca ?? settings?.monedaLocal ?? "EUR";

  const cuentasActivas = useMemo(
    () => accounts.filter((a) => a.activa),
    [accounts],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MortgageFormData>({
    resolver: zodResolver(mortgageFormSchema),
    defaultValues: {
      activa: false,
      precioVivienda: 300000,
      entrada: 60000,
      gastosAsociados: 30000,
      plazoAnios: 25,
      tin: 0.03,
      tipo: "Fija",
      diferencial: 0,
      tipoReferencia: 0,
      aniosTipoFijo: 0,
      moneda: monedaPorDefecto,
      cuentaPagoId: null,
      fechaInicio: new Date(),
      notas: "",
    },
  });

  useEffect(() => {
    if (mortgage) {
      reset({
        activa: mortgage.activa,
        precioVivienda: mortgage.precioVivienda,
        entrada: mortgage.entrada,
        gastosAsociados: mortgage.gastosAsociados,
        plazoAnios: mortgage.plazoAnios,
        tin: mortgage.tin,
        tipo: mortgage.tipo,
        diferencial: mortgage.diferencial,
        tipoReferencia: mortgage.tipoReferencia,
        aniosTipoFijo: mortgage.aniosTipoFijo,
        moneda: mortgage.moneda,
        cuentaPagoId: mortgage.cuentaPagoId ?? null,
        fechaInicio:
          mortgage.fechaInicio instanceof Date
            ? mortgage.fechaInicio
            : new Date(mortgage.fechaInicio),
        notas: mortgage.notas ?? "",
      });
    }
  }, [mortgage, reset]);

  const precioVivienda = watch("precioVivienda");
  const entrada = watch("entrada");
  const gastosAsociados = watch("gastosAsociados");
  const tin = watch("tin");
  const plazoAnios = watch("plazoAnios");
  const tipo = watch("tipo");
  const moneda = watch("moneda");
  const activa = watch("activa");

  const capitalPrestado = useMemo(() => {
    const p = Number(precioVivienda) || 0;
    const e = Number(entrada) || 0;
    const g = Number(gastosAsociados) || 0;
    return Math.max(0, p - e + g);
  }, [precioVivienda, entrada, gastosAsociados]);

  const calculations = useMemo(() => {
    if (capitalPrestado <= 0 || plazoAnios <= 0) return null;
    const summary = summarizeMortgage({
      precioVivienda: Number(precioVivienda) || 0,
      entrada: Number(entrada) || 0,
      gastosAsociados: Number(gastosAsociados) || 0,
      plazoAnios: Number(plazoAnios) || 0,
      tin: Number(tin) || 0,
    });
    const monthly = buildAmortizationTable(
      capitalPrestado,
      Number(tin) || 0,
      Number(plazoAnios) || 0,
    );
    const annual = buildAnnualSummary(monthly);
    return { summary, monthly, annual };
  }, [capitalPrestado, precioVivienda, entrada, gastosAsociados, tin, plazoAnios]);

  const internalSubmit = handleSubmit(async (data) => {
    await upsert({
      activa: data.activa,
      precioVivienda: data.precioVivienda,
      entrada: data.entrada,
      gastosAsociados: data.gastosAsociados,
      plazoAnios: data.plazoAnios,
      tin: data.tin,
      tipo: data.tipo,
      diferencial: data.diferencial,
      tipoReferencia: data.tipoReferencia,
      aniosTipoFijo: data.aniosTipoFijo,
      moneda: data.moneda,
      cuentaPagoId: data.cuentaPagoId ?? null,
      fechaInicio: normalizeDateToUTCNoon(data.fechaInicio),
      notas: data.notas ?? null,
    });
  });

  const handleDeactivate = async () => {
    if (!mortgage) return;
    await clear();
  };

  const toggleYear = (anio: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio);
      else next.add(anio);
      return next;
    });
  };

  const tinPctValue = Number(((tin ?? 0) * 100).toFixed(3));

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const ratioEntrada = precioVivienda > 0 ? (entrada / precioVivienda) * 100 : 0;
  const erroresKeys = Object.keys(errors);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hipoteca</h1>
          <p className="text-sm text-muted-foreground">
            {mortgage && activa
              ? "Tu hipoteca actual. Cualquier cambio se simula en vivo."
              : "Simulador de hipoteca. Calcula cuota mensual, intereses totales y plan de amortizacion."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mortgage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivate}
              disabled={isMutating}
              className="text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Quitar hipoteca
            </Button>
          )}
        </div>
      </header>

      {erroresKeys.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">
                No se puede guardar: revisa los campos
              </p>
              <ul className="text-sm text-destructive/80 space-y-0.5">
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
          </div>
        </div>
      )}

      <form onSubmit={internalSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Parametros</CardTitle>
                <CardDescription>
                  Modifica los valores para ver el efecto en la cuota y la amortizacion.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <Controller
                  control={control}
                  name="activa"
                  render={({ field }) => (
                    <Switch
                      id="activa"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="activa" className="cursor-pointer text-sm">
                  Hipoteca activa
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-precio" className="text-xs">Precio vivienda</Label>
                <Input id="m-precio" type="number" step="1000" min={0} {...register("precioVivienda", { valueAsNumber: true })} />
                {errors.precioVivienda && <p className="text-xs text-destructive">{errors.precioVivienda.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-entrada" className="text-xs">Entrada</Label>
                <Input id="m-entrada" type="number" step="1000" min={0} {...register("entrada", { valueAsNumber: true })} />
                <p className="text-xs text-muted-foreground tabular-nums">{ratioEntrada.toFixed(1)}% del precio</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-gastos" className="text-xs">Gastos asociados</Label>
                <Input id="m-gastos" type="number" step="100" min={0} {...register("gastosAsociados", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Capital prestado</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium tabular-nums">
                  {formatAmount(capitalPrestado, moneda)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-tipo" className="text-xs">Tipo</Label>
                <Controller control={control} name="tipo" render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger id="m-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_HIPOTECA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-tin" className="text-xs">TIN anual (%)</Label>
                <Input id="m-tin" type="number" step="0.01" min={0} max={30} value={tinPctValue}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    setValue("tin", isNaN(pct) ? 0 : pct / 100, { shouldValidate: true });
                  }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-plazo" className="text-xs">Plazo (anios)</Label>
                <Input id="m-plazo" type="number" step="1" min={1} max={50} {...register("plazoAnios", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-moneda" className="text-xs">Moneda</Label>
                <Controller control={control} name="moneda" render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger id="m-moneda"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {/* Cuenta de pago (Lote 11c-fix) */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta de pago</Label>
                <Controller
                  control={control}
                  name="cuentaPagoId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin asignar</SelectItem>
                        {cuentasActivas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.alias}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  La cuota mensual saldra de esta cuenta como movimiento automatico.
                </p>
              </div>
              <div></div>
            </div>

            {(tipo === "Variable" || tipo === "Mixta") && (
              <div className="grid grid-cols-2 gap-3 rounded-md bg-accent/40 p-3 md:grid-cols-4">
                <div className="md:col-span-4">
                  <p className="text-xs font-medium">Parametros variables {tipo === "Mixta" && "(tras periodo fijo)"}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Diferencial (%)</Label>
                  <Input type="number" step="0.01" min={0}
                    value={Number(((watch("diferencial") ?? 0) * 100).toFixed(3))}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      setValue("diferencial", isNaN(pct) ? 0 : pct / 100);
                    }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo referencia (%)</Label>
                  <Input type="number" step="0.01" min={0}
                    value={Number(((watch("tipoReferencia") ?? 0) * 100).toFixed(3))}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      setValue("tipoReferencia", isNaN(pct) ? 0 : pct / 100);
                    }} />
                </div>
                {tipo === "Mixta" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Anios tipo fijo</Label>
                    <Input type="number" step="1" min={0} {...register("aniosTipoFijo", { valueAsNumber: true })} />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha inicio</Label>
                <Controller control={control} name="fechaInicio" render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? formatDateLong(field.value, false) : "Selecciona"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value}
                        onSelect={(d) => { if (d) { field.onChange(d); setCalendarOpen(false); } }} />
                    </PopoverContent>
                  </Popover>
                )} />
                {errors.fechaInicio && <p className="text-xs text-destructive">{errors.fechaInicio.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas (opcional)</Label>
                <Textarea rows={1} {...register("notas")} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isMutating}>
                <Save className="mr-2 h-4 w-4" />
                {isMutating ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {calculations && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiMortgage icon={Calculator} label="Cuota mensual" value={formatAmount(calculations.summary.cuotaMensual, moneda)} hint={`${calculations.summary.numeroCuotas} cuotas`} intent="primary" />
              <KpiMortgage icon={Home} label="Capital prestado" value={formatAmount(calculations.summary.capitalPrestado, moneda)} />
              <KpiMortgage icon={TrendingUp} label="Total intereses" value={formatAmount(calculations.summary.totalIntereses, moneda)} intent="negative" />
              <KpiMortgage icon={Home} label="Total a pagar" value={formatAmount(calculations.summary.totalAPagar, moneda)} />
            </div>

            <Card>
              <CardHeader><CardTitle>Evolucion de la amortizacion</CardTitle></CardHeader>
              <CardContent>
                <AmortizationChart data={calculations.annual} capitalInicial={calculations.summary.capitalPrestado} moneda={moneda} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Plan de amortizacion</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[60px]">Anio</TableHead>
                      <TableHead className="text-right">Cuota anual</TableHead>
                      <TableHead className="text-right">Intereses</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Amortizado</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculations.annual.map((row) => (
                      <YearRowFragment key={row.anio} row={row} moneda={moneda}
                        expanded={expandedYears.has(row.anio)} onToggle={() => toggleYear(row.anio)} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </form>
    </div>
  );
}

function YearRowFragment({ row, moneda, expanded, onToggle }: {
  row: AnnualSummaryRow; moneda: string; expanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={onToggle}>
        <TableCell>{expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
        <TableCell className="font-medium">{row.anio}</TableCell>
        <TableCell className="text-right tabular-nums">{formatAmount(row.cuotaAnual, moneda)}</TableCell>
        <TableCell className="text-right tabular-nums text-destructive/80">{formatAmount(row.interesesAnio, moneda)}</TableCell>
        <TableCell className="text-right tabular-nums text-primary">{formatAmount(row.capitalAnio, moneda)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatAmount(row.capitalAmortizado, moneda)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatAmount(row.capitalPendiente, moneda)}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={7} className="p-0">
            <div className="px-8 py-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-0">
                    <TableHead className="h-8 w-[60px] text-xs">Mes</TableHead>
                    <TableHead className="h-8 text-right text-xs">Cuota</TableHead>
                    <TableHead className="h-8 text-right text-xs">Intereses</TableHead>
                    <TableHead className="h-8 text-right text-xs">Capital</TableHead>
                    <TableHead className="h-8 text-right text-xs">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.meses.map((m) => (
                    <TableRow key={m.mes} className="border-b-0 text-xs">
                      <TableCell className="py-1 font-mono text-muted-foreground">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">#{m.mes}</Badge>
                      </TableCell>
                      <TableCell className="py-1 text-right tabular-nums">{formatAmount(m.cuota, moneda)}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums text-destructive/70">{formatAmount(m.intereses, moneda)}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums text-primary">{formatAmount(m.amortizacion, moneda)}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums text-muted-foreground">{formatAmount(m.capitalFinal, moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function KpiMortgage({ icon: Icon, label, value, hint, intent = "neutral" }: {
  icon: typeof Home; label: string; value: string; hint?: string; intent?: "neutral" | "primary" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums",
          intent === "primary" && "text-primary",
          intent === "negative" && "text-destructive",
        )}>
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
