"use client";

/**
 * src/components/forms/MovementFormDialog.tsx
 *
 * Modal CRUD para movimientos. El tipo se elige arriba (tabs) y los
 * campos del formulario se adaptan.
 *
 * Tipos soportados en creacion: gasto, ingreso, transferencia.
 * Tipos soportados en edicion: gasto, ingreso, transferencia, ajuste.
 * (Ajuste solo se crea desde la pantalla de conciliacion; aqui solo se
 * permite editarlo: fecha, cuenta, importe, sentido, concepto, notas.)
 *
 * Para ediciones, el tipo no es cambiable (cambiar de gasto a ingreso
 * implica recategorizar todo). Si necesitas cambiar el tipo, borra y
 * crea uno nuevo.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useCategorySuggestion } from "@/hooks/useCategorySuggestion";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  gastoFormSchema,
  ingresoFormSchema,
  transferenciaFormSchema,
  ajusteFormSchema,
  type GastoFormData,
  type IngresoFormData,
  type TransferenciaFormData,
  type AjusteFormData,
  CATEGORIAS_INGRESO_EXTRA,
} from "@/lib/schemas/forms";
import type { Movement, Currency, Category, Account } from "@/lib/db/schema";
import type { CreateMovementData, MovementType } from "@/lib/repositories";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";
import { formatDateLong, normalizeDateToUTCNoon } from "@/lib/utils/dates";

type FormTipo = "gasto" | "ingreso" | "transferencia" | "ajuste" | "devolucion";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Movement | null;
  /** Tipo precargado si es nuevo (e.g. desde un boton "+ gasto") */
  initialTipo?: FormTipo;
  currencies: Currency[];
  categories: Category[];
  accounts: Account[];
  monedaLocal: string;
  defaultAccountId?: string | null;
  onSubmit: (data: CreateMovementData) => Promise<void>;
  loading?: boolean;
};

export function MovementFormDialog({
  open,
  onOpenChange,
  initial,
  initialTipo = "gasto",
  currencies,
  categories,
  accounts,
  monedaLocal,
  defaultAccountId,
  onSubmit,
  loading = false,
}: Props) {
  const isEdit = !!initial;

  // El tipo del formulario. En edicion viene del initial. En creacion del
  // initialTipo o lo que elija el usuario en las tabs.
  const [formTipo, setFormTipo] = useState<FormTipo>(
    initial ? movementTypeToForm(initial.tipo) : initialTipo,
  );

  // Cuando se reabre el modal, reseteamos el tipo segun el initial/initialTipo
  useEffect(() => {
    if (open) {
      setFormTipo(initial ? movementTypeToForm(initial.tipo) : initialTipo);
    }
  }, [open, initial, initialTipo]);

  // ----- formularios separados por tipo -----
  const gastoForm = useForm<GastoFormData>({
    resolver: zodResolver(gastoFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "",
      importe: 0,
      moneda: monedaLocal,
      cuentaOrigenId: defaultAccountId ?? "",
      categoriaId: "",
      notas: "",
    },
  });

  const ingresoForm = useForm<IngresoFormData>({
    resolver: zodResolver(ingresoFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "",
      importe: 0,
      moneda: monedaLocal,
      cuentaDestinoId: defaultAccountId ?? null,
      categoriaTexto: "Bonus",
      notas: "",
    },
  });

  const transferenciaForm = useForm<TransferenciaFormData>({
    resolver: zodResolver(transferenciaFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "Transferencia",
      importe: 0,
      moneda: monedaLocal,
      cuentaOrigenId: "",
      cuentaDestinoId: "",
      notas: "",
    },
  });

  // El form de ajuste solo se usa en edicion (la creacion va por Conciliacion
  // en /cuentas). Modelamos cuentaOrigenId/cuentaDestinoId con UI de
  // "cuenta + sentido": positivo=cuentaDestino, negativo=cuentaOrigen.
  const ajusteForm = useForm<AjusteFormData>({
    resolver: zodResolver(ajusteFormSchema),
    defaultValues: {
      fecha: new Date(),
      concepto: "Ajuste",
      importe: 0,
      moneda: monedaLocal,
      cuentaOrigenId: null,
      cuentaDestinoId: null,
      notas: "",
    },
  });

  // Hidratar al abrir
  useEffect(() => {
    if (!open) return;

    if (initial) {
      const fecha =
        initial.fecha instanceof Date ? initial.fecha : new Date(initial.fecha);

      if (
        initial.tipo === "gasto" ||
        initial.tipo === "cuota" ||
        initial.tipo === "devolucion"
      ) {
        gastoForm.reset({
          fecha,
          concepto: initial.concepto,
          importe: initial.importe,
          moneda: initial.moneda,
          // En una devolucion la cuenta esta en destino (el dinero entra);
          // la mostramos en el mismo campo de cuenta del formulario.
          cuentaOrigenId:
            (initial.tipo === "devolucion"
              ? initial.cuentaDestinoId
              : initial.cuentaOrigenId) ?? "",
          categoriaId: initial.categoriaId ?? "",
          notas: initial.notas ?? "",
        });
      } else if (initial.tipo === "ingreso" || initial.tipo === "intereses") {
        ingresoForm.reset({
          fecha,
          concepto: initial.concepto,
          importe: initial.importe,
          moneda: initial.moneda,
          cuentaDestinoId: initial.cuentaDestinoId ?? null,
          categoriaTexto: initial.categoriaTexto ?? "Otros",
          notas: initial.notas ?? "",
        });
      } else if (initial.tipo === "transferencia") {
        transferenciaForm.reset({
          fecha,
          concepto: initial.concepto,
          importe: initial.importe,
          moneda: initial.moneda,
          cuentaOrigenId: initial.cuentaOrigenId ?? "",
          cuentaDestinoId: initial.cuentaDestinoId ?? "",
          notas: initial.notas ?? "",
        });
      } else if (initial.tipo === "ajuste") {
        ajusteForm.reset({
          fecha,
          concepto: initial.concepto,
          importe: initial.importe,
          moneda: initial.moneda,
          cuentaOrigenId: initial.cuentaOrigenId ?? null,
          cuentaDestinoId: initial.cuentaDestinoId ?? null,
          notas: initial.notas ?? "",
        });
      }
    } else {
      // creacion: reset a defaults
      gastoForm.reset({
        fecha: new Date(),
        concepto: "",
        importe: 0,
        moneda: monedaLocal,
        cuentaOrigenId: defaultAccountId ?? "",
        categoriaId: "",
        notas: "",
      });
      ingresoForm.reset({
        fecha: new Date(),
        concepto: "",
        importe: 0,
        moneda: monedaLocal,
        cuentaDestinoId: defaultAccountId ?? null,
        categoriaTexto: "Bonus",
        notas: "",
      });
      transferenciaForm.reset({
        fecha: new Date(),
        concepto: "Transferencia",
        importe: 0,
        moneda: monedaLocal,
        cuentaOrigenId: "",
        cuentaDestinoId: "",
        notas: "",
      });
    }
  }, [
    open,
    initial,
    monedaLocal,
    defaultAccountId,
    gastoForm,
    ingresoForm,
    transferenciaForm,
    ajusteForm,
  ]);

  // Lista de cuentas activas (para los selects)
  const cuentasActivas = useMemo(
    () => accounts.filter((a) => a.activa),
    [accounts],
  );

  const handleGastoSubmit = gastoForm.handleSubmit(async (data) => {
    const fecha = normalizeDateToUTCNoon(data.fecha);
    const esDevolucion = formTipo === "devolucion";
    await onSubmit({
      tipo: esDevolucion ? "devolucion" : "gasto",
      fecha,
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
      concepto: data.concepto,
      importe: data.importe,
      moneda: data.moneda,
      // En una devolucion el dinero ENTRA en la cuenta -> va a destino, para
      // que el saldo se acredite con la logica generica.
      cuentaOrigenId: esDevolucion ? null : data.cuentaOrigenId,
      cuentaDestinoId: esDevolucion ? data.cuentaOrigenId : null,
      categoriaId: data.categoriaId,
      categoriaTexto: null,
      notas: data.notas ?? null,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    onOpenChange(false);
  });

  const handleIngresoSubmit = ingresoForm.handleSubmit(async (data) => {
    const fecha = normalizeDateToUTCNoon(data.fecha);
    await onSubmit({
      tipo: "ingreso",
      fecha,
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
      concepto: data.concepto,
      importe: data.importe,
      moneda: data.moneda,
      cuentaOrigenId: null,
      cuentaDestinoId: data.cuentaDestinoId ?? null,
      categoriaId: null,
      categoriaTexto: data.categoriaTexto,
      notas: data.notas ?? null,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    onOpenChange(false);
  });

  const handleTransferenciaSubmit = transferenciaForm.handleSubmit(
    async (data) => {
      const fecha = normalizeDateToUTCNoon(data.fecha);
      await onSubmit({
        tipo: "transferencia",
        fecha,
        mes: fecha.getUTCMonth() + 1,
        anio: fecha.getUTCFullYear(),
        concepto: data.concepto,
        importe: data.importe,
        moneda: data.moneda,
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        categoriaId: null,
        categoriaTexto: null,
        notas: data.notas ?? null,
        esAutomatico: false,
        origenAutomatico: null,
        origenAutomaticoId: null,
      });
      onOpenChange(false);
    },
  );

  const handleAjusteSubmit = ajusteForm.handleSubmit(async (data) => {
    const fecha = normalizeDateToUTCNoon(data.fecha);
    await onSubmit({
      tipo: "ajuste",
      fecha,
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
      concepto: data.concepto,
      importe: data.importe,
      moneda: data.moneda,
      cuentaOrigenId: data.cuentaOrigenId ?? null,
      cuentaDestinoId: data.cuentaDestinoId ?? null,
      categoriaId: null,
      categoriaTexto: "Ajuste",
      notas: data.notas ?? null,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    onOpenChange(false);
  });

  // Categorizacion automatica: al SALIR del campo concepto (solo creando un
  // gasto), si la categoria esta vacia, la pre-rellenamos con la mas usada para
  // conceptos parecidos. Es una sugerencia: el usuario puede cambiarla.
  const suggest = useCategorySuggestion();
  const gastoConceptoReg = gastoForm.register("concepto");
  const aplicarSugerenciaCategoria = () => {
    if (isEdit) return;
    const concepto = gastoForm.getValues("concepto");
    if (!concepto?.trim()) return;
    if (gastoForm.getValues("categoriaId")) return; // no pisar lo ya elegido
    const cat = suggest(concepto);
    if (cat && categories.some((c) => c.id === cat)) {
      gastoForm.setValue("categoriaId", cat, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-3 overflow-y-auto p-4 sm:max-w-lg sm:gap-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar movimiento" : "Nuevo movimiento"}
          </DialogTitle>
          {/* Descripcion solo en pantallas grandes: en movil ocupa espacio. */}
          <DialogDescription className="hidden sm:block">
            {isEdit
              ? "Modifica los datos del movimiento."
              : "Registra un gasto, un ingreso o una transferencia entre cuentas."}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs de tipo (solo en creacion, en edicion estan disabled).
            La tab "Ajuste" SOLO aparece editando un ajuste, ya que se crea
            via conciliacion en /cuentas. */}
        {/* En MOVIL: desplegable (mas compacto). Al editar va deshabilitado
            porque un movimiento no puede cambiar de tipo (un gasto no puede
            pasar a ingreso). En ESCRITORIO: las pestañas de siempre. */}
        <div className="sm:hidden">
          <Select
            value={formTipo}
            onValueChange={(v) => setFormTipo(v as FormTipo)}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gasto">Gasto</SelectItem>
              <SelectItem value="ingreso">Ingreso</SelectItem>
              <SelectItem value="devolucion">Devolución</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
              {formTipo === "ajuste" && (
                <SelectItem value="ajuste">Ajuste</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Tabs
          value={formTipo}
          onValueChange={(v) => setFormTipo(v as FormTipo)}
          className="hidden sm:block"
        >
          <TabsList
            className={cn(
              "grid w-full",
              formTipo === "ajuste" ? "grid-cols-5" : "grid-cols-4",
            )}
          >
            <TabsTrigger
              value="gasto"
              disabled={isEdit && formTipo !== "gasto"}
            >
              Gasto
            </TabsTrigger>
            <TabsTrigger
              value="ingreso"
              disabled={isEdit && formTipo !== "ingreso"}
            >
              Ingreso
            </TabsTrigger>
            <TabsTrigger
              value="devolucion"
              disabled={isEdit && formTipo !== "devolucion"}
            >
              Devolución
            </TabsTrigger>
            <TabsTrigger
              value="transferencia"
              disabled={isEdit && formTipo !== "transferencia"}
            >
              Transfer.
            </TabsTrigger>
            {formTipo === "ajuste" && (
              <TabsTrigger value="ajuste" disabled>
                Ajuste
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* === GASTO / DEVOLUCION === */}
        {(formTipo === "gasto" || formTipo === "devolucion") && (
          <form onSubmit={handleGastoSubmit} className="space-y-4">
            <FechaImporteMoneda
              control={gastoForm.control}
              register={gastoForm.register}
              currencies={currencies}
              errors={gastoForm.formState.errors}
            />
            <div className="space-y-2">
              <Label htmlFor="g-concepto">Concepto</Label>
              <Input
                id="g-concepto"
                {...gastoConceptoReg}
                onBlur={(e) => {
                  gastoConceptoReg.onBlur(e);
                  aplicarSugerenciaCategoria();
                }}
                placeholder={
                  formTipo === "devolucion"
                    ? "Devolución de una compra..."
                    : "Restaurante con amigos..."
                }
              />
              {gastoForm.formState.errors.concepto && (
                <p className="text-xs text-destructive">
                  {gastoForm.formState.errors.concepto.message}
                </p>
              )}
            </div>
            {formTipo === "devolucion" && (
              <p className="-mt-2 text-xs text-muted-foreground">
                La devolución resta del gasto de su categoría y suma a la cuenta.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  {formTipo === "devolucion"
                    ? "Entra en la cuenta"
                    : "Cuenta origen"}
                </Label>
                <Controller
                  control={gastoForm.control}
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
                {gastoForm.formState.errors.cuentaOrigenId && (
                  <p className="text-xs text-destructive">
                    {gastoForm.formState.errors.cuentaOrigenId.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Controller
                  control={gastoForm.control}
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
                {gastoForm.formState.errors.categoriaId && (
                  <p className="text-xs text-destructive">
                    {gastoForm.formState.errors.categoriaId.message}
                  </p>
                )}
              </div>
            </div>
            <Notas register={gastoForm.register} name="notas" />
            <FooterButtons
              loading={loading}
              isEdit={isEdit}
              onCancel={() => onOpenChange(false)}
            />
          </form>
        )}

        {/* === INGRESO === */}
        {formTipo === "ingreso" && (
          <form onSubmit={handleIngresoSubmit} className="space-y-4">
            <FechaImporteMoneda
              control={ingresoForm.control}
              register={ingresoForm.register}
              currencies={currencies}
              errors={ingresoForm.formState.errors}
            />
            <div className="space-y-2">
              <Label htmlFor="i-concepto">Concepto</Label>
              <Input
                id="i-concepto"
                {...ingresoForm.register("concepto")}
                placeholder="Bonus anual, venta de algo..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cuenta destino (opcional)</Label>
                <Controller
                  control={ingresoForm.control}
                  name="cuentaDestinoId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) =>
                        field.onChange(v === "__none__" ? null : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
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
                <Label>Categoria</Label>
                <Controller
                  control={ingresoForm.control}
                  name="categoriaTexto"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
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
            </div>
            <Notas register={ingresoForm.register} name="notas" />
            <FooterButtons
              loading={loading}
              isEdit={isEdit}
              onCancel={() => onOpenChange(false)}
            />
          </form>
        )}

        {/* === TRANSFERENCIA === */}
        {formTipo === "transferencia" && (
          <form onSubmit={handleTransferenciaSubmit} className="space-y-4">
            <FechaImporteMoneda
              control={transferenciaForm.control}
              register={transferenciaForm.register}
              currencies={currencies}
              errors={transferenciaForm.formState.errors}
            />
            <div className="space-y-2">
              <Label htmlFor="t-concepto">Concepto</Label>
              <Input
                id="t-concepto"
                {...transferenciaForm.register("concepto")}
                placeholder="Traspaso a ahorro, recarga broker..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cuenta origen</Label>
                <Controller
                  control={transferenciaForm.control}
                  name="cuentaOrigenId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Origen" />
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
                <Label>Cuenta destino</Label>
                <Controller
                  control={transferenciaForm.control}
                  name="cuentaDestinoId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Destino" />
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
                {transferenciaForm.formState.errors.cuentaDestinoId && (
                  <p className="text-xs text-destructive">
                    {transferenciaForm.formState.errors.cuentaDestinoId.message}
                  </p>
                )}
              </div>
            </div>
            <Notas register={transferenciaForm.register} name="notas" />
            <FooterButtons
              loading={loading}
              isEdit={isEdit}
              onCancel={() => onOpenChange(false)}
            />
          </form>
        )}

        {/* === AJUSTE === (solo edicion) */}
        {formTipo === "ajuste" && (
          <AjusteForm
            form={ajusteForm}
            cuentasActivas={cuentasActivas}
            currencies={currencies}
            onSubmit={handleAjusteSubmit}
            onCancel={() => onOpenChange(false)}
            loading={loading}
            isEdit={isEdit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-form de Ajuste
// ---------------------------------------------------------------------------

function AjusteForm({
  form,
  cuentasActivas,
  currencies,
  onSubmit,
  onCancel,
  loading,
  isEdit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  cuentasActivas: Account[];
  currencies: Currency[];
  onSubmit: (e?: React.BaseSyntheticEvent) => void | Promise<void>;
  onCancel: () => void;
  loading: boolean;
  isEdit: boolean;
}) {
  const cuentaOrigen = form.watch("cuentaOrigenId") as string | null;
  const cuentaDestino = form.watch("cuentaDestinoId") as string | null;
  const cuentaActual = cuentaDestino ?? cuentaOrigen ?? "";
  const sentido: "positivo" | "negativo" = cuentaDestino ? "positivo" : "negativo";

  const setCuenta = (cuentaId: string) => {
    if (sentido === "positivo") {
      form.setValue("cuentaDestinoId", cuentaId, { shouldValidate: true });
      form.setValue("cuentaOrigenId", null, { shouldValidate: true });
    } else {
      form.setValue("cuentaOrigenId", cuentaId, { shouldValidate: true });
      form.setValue("cuentaDestinoId", null, { shouldValidate: true });
    }
  };

  const setSentido = (next: "positivo" | "negativo") => {
    if (next === sentido) return;
    const cuentaId = cuentaActual;
    if (next === "positivo") {
      form.setValue("cuentaDestinoId", cuentaId || null, { shouldValidate: true });
      form.setValue("cuentaOrigenId", null, { shouldValidate: true });
    } else {
      form.setValue("cuentaOrigenId", cuentaId || null, { shouldValidate: true });
      form.setValue("cuentaDestinoId", null, { shouldValidate: true });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FechaImporteMoneda
        control={form.control}
        register={form.register}
        currencies={currencies}
        errors={form.formState.errors}
      />
      <div className="space-y-2">
        <Label htmlFor="a-concepto">Concepto</Label>
        <Input
          id="a-concepto"
          {...form.register("concepto")}
          placeholder="Conciliacion de saldo..."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cuenta</Label>
          <Select value={cuentaActual} onValueChange={setCuenta}>
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
          {form.formState.errors.cuentaDestinoId && (
            <p className="text-xs text-destructive">
              {form.formState.errors.cuentaDestinoId.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Sentido</Label>
          <Select
            value={sentido}
            onValueChange={(v) => setSentido(v as "positivo" | "negativo")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="positivo">Positivo (suma a la cuenta)</SelectItem>
              <SelectItem value="negativo">Negativo (resta de la cuenta)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Notas register={form.register} name="notas" />
      <FooterButtons
        loading={loading}
        isEdit={isEdit}
        onCancel={onCancel}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpers compartidos entre los tres forms
// ---------------------------------------------------------------------------

function movementTypeToForm(tipo: MovementType): FormTipo {
  if (tipo === "gasto" || tipo === "cuota") return "gasto";
  if (tipo === "devolucion") return "devolucion";
  if (tipo === "ingreso" || tipo === "intereses") return "ingreso";
  if (tipo === "transferencia") return "transferencia";
  if (tipo === "ajuste") return "ajuste";
  return "gasto";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FechaImporteMoneda({ control, register, currencies, errors }: any) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_120px_100px]">
      {/* En movil la fecha ocupa toda la fila y debajo van Importe + Moneda
          (asi la moneda no queda apretada a la derecha). */}
      <div className="col-span-2 space-y-2 sm:col-span-1">
        <Label>Fecha</Label>
        <Controller
          control={control}
          name="fecha"
          render={({ field }) => (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                    : "Selecciona"}
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
                />
              </PopoverContent>
            </Popover>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label>Importe</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          {...register("importe", { valueAsNumber: true })}
        />
        {errors.importe && (
          <p className="text-xs text-destructive">{errors.importe.message}</p>
        )}
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
                {currencies.map((c: Currency) => (
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
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Notas({ register, name }: { register: any; name: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-input`}>Notas (opcional)</Label>
      <Textarea id={`${name}-input`} rows={1} {...register(name)} />
    </div>
  );
}

function FooterButtons({
  loading,
  isEdit,
  onCancel,
}: {
  loading: boolean;
  isEdit: boolean;
  onCancel: () => void;
}) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={loading}>
        {loading
          ? "Guardando..."
          : isEdit
            ? "Guardar cambios"
            : "Crear movimiento"}
      </Button>
    </DialogFooter>
  );
}
