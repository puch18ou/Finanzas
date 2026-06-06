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
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usaParticipaciones } from "@/lib/domain/investments";
import { resolveSymbolByIsin } from "@/lib/services/quote-service";
import { Calendar as CalendarIcon, Trash2, Search } from "lucide-react";
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
  /** Si se indica y estamos editando, muestra "Borrar" en el pie del dialogo. */
  onDelete?: () => void;
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
  onDelete,
  loading = false,
}: Props) {
  const isEdit = !!initial;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [buscandoIsin, setBuscandoIsin] = useState(false);
  const [isinMsg, setIsinMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      tipo: "Acciones",
      ticker: "",
      isin: "",
      nombre: "",
      participaciones: 0,
      precioUnitario: 0,
      comision: 0,
      importeInvertido: 0,
      valorActual: 0,
      unidadesCotizacion: null,
      moneda: monedaLocal,
      cuentaId: "",
      fechaCompra: null,
      notas: "",
      tasaInteres: null,
      frecuenciaInteres: "mensual",
      interesCompuesto: true,
    },
  });

  // Tipo seleccionado en vivo: decide si la inversion va por participaciones
  // (Acciones/ETF/Cripto) o en modo "solo dinero" (resto).
  const tipoSel = useWatch({ control, name: "tipo" });
  const conParticipaciones = usaParticipaciones(tipoSel ?? "Acciones");

  useEffect(() => {
    if (open) {
      if (initial) {
        // En modo participaciones (Acciones/ETF/Cripto) el campo "valor actual"
        // representa el PRECIO POR UNIDAD (como cotiza en bolsa). En modo
        // dinero, el VALOR TOTAL.
        const usaPart = usaParticipaciones(initial.tipo);
        reset({
          tipo: initial.tipo,
          ticker: initial.ticker ?? "",
          isin: initial.isin ?? "",
          nombre: initial.nombre,
          participaciones: initial.participaciones,
          precioUnitario: initial.precioCompra,
          comision: 0,
          importeInvertido: initial.precioCompra * initial.participaciones,
          valorActual: usaPart
            ? initial.precioActual
            : initial.precioActual * initial.participaciones,
          unidadesCotizacion: initial.unidadesCotizacion ?? null,
          moneda: initial.moneda,
          cuentaId: initial.cuentaId ?? "",
          fechaCompra:
            initial.fechaCompra instanceof Date
              ? initial.fechaCompra
              : initial.fechaCompra
              ? new Date(initial.fechaCompra)
              : null,
          notas: initial.notas ?? "",
          tasaInteres: initial.tasaInteres ?? null,
          frecuenciaInteres:
            (initial.frecuenciaInteres as "mensual" | "trimestral" | "anual" | null) ??
            "mensual",
          interesCompuesto: initial.interesCompuesto ?? true,
        });
      } else {
        reset({
          tipo: "Acciones",
          ticker: "",
          isin: "",
          nombre: "",
          participaciones: 0,
          precioUnitario: 0,
          comision: 0,
          importeInvertido: 0,
          valorActual: 0,
          moneda: monedaLocal,
          cuentaId: "",
          fechaCompra: null,
          notas: "",
          tasaInteres: null,
          frecuenciaInteres: "mensual",
          interesCompuesto: true,
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
    if (!isEdit && conParticipaciones) {
      if (!(data.participaciones > 0)) {
        setError("participaciones", {
          type: "manual",
          message: "Debe ser mayor que 0",
        });
        return;
      }
      if (!data.precioUnitario || data.precioUnitario <= 0) {
        setError("precioUnitario", {
          type: "manual",
          message: "Debe ser mayor que 0",
        });
        return;
      }
    }
    if (!isEdit && !conParticipaciones && !(data.importeInvertido > 0)) {
      setError("importeInvertido", {
        type: "manual",
        message: "Debe ser mayor que 0",
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

  // Busca el simbolo de cotizacion a partir del ISIN (Yahoo) y rellena el
  // ticker. Para fondos no cotizados (CaixaBank y similares) no habra match.
  const handleBuscarIsin = async () => {
    const isin = (getValues("isin") ?? "").trim();
    if (!isin) {
      setIsinMsg("Escribe un ISIN primero.");
      return;
    }
    setBuscandoIsin(true);
    setIsinMsg(null);
    try {
      const match = await resolveSymbolByIsin(isin);
      if (!match) {
        setIsinMsg(
          "No encontrado (suele pasar con fondos no cotizados). Pon el ticker a mano o deja el precio manual.",
        );
        return;
      }
      setValue("ticker", match.symbol, { shouldDirty: true });
      if (!(getValues("nombre") ?? "").trim()) {
        setValue("nombre", match.nombre, { shouldDirty: true });
      }
      setIsinMsg(
        `Encontrado: ${match.symbol} · ${match.nombre}${match.tipo ? ` (${match.tipo})` : ""}`,
      );
    } catch (e) {
      setIsinMsg(e instanceof Error ? e.message : "Error buscando el ISIN.");
    } finally {
      setBuscandoIsin(false);
    }
  };

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
                placeholder="AAPL, ITX.MC, VWCE.DE..."
                disabled={loading}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Simbolo de Yahoo para cotizar. No-US lleva sufijo de mercado
                (.MC Madrid, .DE Xetra...).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-isin">ISIN (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="inv-isin"
                {...register("isin")}
                placeholder="IE00B4L5Y983, ES0..."
                disabled={loading}
                className="font-mono uppercase"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBuscarIsin}
                disabled={loading || buscandoIsin}
              >
                <Search className="mr-1 h-4 w-4" />
                {buscandoIsin ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isinMsg ??
                "Pega el ISIN y pulsa Buscar para rellenar el ticker (si Yahoo lo tiene)."}
            </p>
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

          {/* Participaciones / precio / comision (modo broker) o importe total
              (modo dinero). SOLO al crear; al editar esos valores vienen de
              las aportaciones. */}
          {!isEdit && (
            <>
              {conParticipaciones ? (
                <div className="grid grid-cols-3 gap-3">
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
                    <Label htmlFor="inv-precio-u">Precio por unidad</Label>
                    <Input
                      id="inv-precio-u"
                      type="number"
                      step="0.000001"
                      {...register("precioUnitario", { valueAsNumber: true })}
                      disabled={loading}
                    />
                    {errors.precioUnitario && (
                      <p className="text-xs text-destructive">{errors.precioUnitario.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-comision">Comision (opcional)</Label>
                    <Input
                      id="inv-comision"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...register("comision", { valueAsNumber: true })}
                      disabled={loading}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-w-[260px]">
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
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Valor actual. En modo participaciones (Acciones/ETF/Cripto)
                se introduce el PRECIO POR UNIDAD; en modo dinero, el TOTAL. */}
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="inv-valor-a">
                  {conParticipaciones
                    ? "Precio actual (por unidad)"
                    : "Valor actual (total)"}
                </Label>
                <Input
                  id="inv-valor-a"
                  type="number"
                  step="0.000001"
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

          {/* Solo fondos "por dinero": participaciones reales para cotizar por
              VL (valor = unidades x VL). Los activos por unidades ya cotizan
              con su precio por unidad. */}
          {!conParticipaciones && (
            <div className="space-y-2 max-w-[260px]">
              <Label htmlFor="inv-unidades">Participaciones (unidades)</Label>
              <Input
                id="inv-unidades"
                type="number"
                step="0.000001"
                placeholder="0"
                {...register("unidadesCotizacion", {
                  setValueAs: (v) =>
                    v === "" || v == null ? null : Number(v),
                })}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Tus unidades del fondo (CaixaBank las muestra). Necesario para
                actualizar el valor por el VL: valor = participaciones × VL.
              </p>
            </div>
          )}

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

          {/* TAE automatica: solo para "Cuenta remunerada" (Lote 16). */}
          {tipoSel === "Cuenta remunerada" && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Interes automatico (TAE)
              </p>
              <div className="grid grid-cols-[120px_1fr_1fr] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inv-tae">TAE (%)</Label>
                  <Input
                    id="inv-tae"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    {...register("tasaInteres", {
                      setValueAs: (v) =>
                        v === "" || v == null ? null : Number(v),
                    })}
                    disabled={loading}
                  />
                  {errors.tasaInteres && (
                    <p className="text-xs text-destructive">
                      {errors.tasaInteres.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <Controller
                    control={control}
                    name="frecuenciaInteres"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? "mensual"}
                        onValueChange={field.onChange}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensual">Mensual</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modo</Label>
                  <Controller
                    control={control}
                    name="interesCompuesto"
                    render={({ field }) => (
                      <Select
                        value={field.value ? "compuesto" : "simple"}
                        onValueChange={(v) => field.onChange(v === "compuesto")}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compuesto">Compuesto</SelectItem>
                          <SelectItem value="simple">Simple</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dejar TAE en 0 o vacio para desactivar. El interes se aplica al
                arrancar la app: sube el valor de la inversion (no genera
                movimientos).
              </p>
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

          <DialogFooter className={cn(isEdit && onDelete && "sm:justify-between")}>
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={loading}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Borrar
              </Button>
            )}
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
