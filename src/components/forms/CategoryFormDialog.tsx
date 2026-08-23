"use client";

/**
 * ============================================================================
 *  src/components/forms/CategoryFormDialog.tsx
 * ============================================================================
 *
 *  Dialog modal con el formulario de crear/editar categoria.
 *
 *  ARQUITECTURA DEL FORMULARIO
 *  ---------------------------
 *  Usamos react-hook-form como el formulario completo. Es la libreria
 *  estandar de React por:
 *
 *    - Rendimiento: re-renderiza solo el campo que cambia, no todo el form
 *    - API minima: <Controller> + register()
 *    - Integracion con Zod via @hookform/resolvers
 *
 *  PATRON CONTROLLED FORM
 *  ----------------------
 *  Algunos componentes de shadcn (Input, Switch) son "controlled" — esperan
 *  un value + onChange. Otros (Select) tambien. react-hook-form maneja
 *  estos casos con dos APIs:
 *
 *    register('campo')    → para inputs nativos (Input texto, numero)
 *    Controller           → para componentes con API propia (Select, Switch)
 *
 *  PROPIEDADES
 *  -----------
 *    open / onOpenChange  estado controlado por el padre
 *    initial              fila a editar (undefined = crear nuevo)
 *    monedaLocal          codigo de moneda local actual (para el default
 *                         de presupuestoMoneda al crear)
 *    currencies           lista de monedas para el Select
 *    onSubmit             callback con los datos validados; el dialog se
 *                         cierra solo si onSubmit() no lanza
 *    loading              deshabilita inputs y boton de guardar
 * ============================================================================
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  categoryFormSchema,
  type CategoryFormData,
  TIPOS_CATEGORIA,
} from "@/lib/schemas/forms";
import type { Category, Currency } from "@/lib/db/schema";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Category | null;
  monedaLocal: string;
  currencies: Currency[];
  onSubmit: (data: CategoryFormData) => Promise<void>;
  loading?: boolean;
  /** modal=false + sin cierre por click-fuera/Escape: lo usa el demo. */
  modal?: boolean;
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  initial,
  monedaLocal,
  currencies,
  onSubmit,
  loading = false,
  modal = true,
}: Props) {
  const isEdit = !!initial;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    // Valores por defecto: si estamos editando, los de la fila; si no, vacios sensatos
    defaultValues: {
      nombre: "",
      tipo: "Esencial",
      presupuestoMensual: 0,
      presupuestoMoneda: monedaLocal,
      notas: "",
      color: null,
      icono: null,
    },
  });

  // Cuando cambia `initial` (porque seleccionas otra fila para editar),
  // reseteamos el formulario con sus valores.
  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          nombre: initial.nombre,
          tipo: initial.tipo,
          presupuestoMensual: initial.presupuestoMensual,
          presupuestoMoneda: initial.presupuestoMoneda,
          notas: initial.notas ?? "",
          color: initial.color,
          icono: initial.icono,
        });
      } else {
        reset({
          nombre: "",
          tipo: "Esencial",
          presupuestoMensual: 0,
          presupuestoMoneda: monedaLocal,
          notas: "",
          color: null,
          icono: null,
        });
      }
    }
  }, [initial, open, monedaLocal, reset]);

  const internalSubmit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch {
      // El error ya lo mostro el hook como toast
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent
        className="sm:max-w-md"
        data-tour="category-form"
        showCloseButton={modal}
        onInteractOutside={(e) => {
          if (!modal) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!modal) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nueva categoria"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos y pulsa Guardar."
              : "Anade una nueva categoria de gasto. Puedes editarla mas tarde."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={internalSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              {...register("nombre")}
              placeholder="Vivienda, Supermercado, Ocio..."
              disabled={loading}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CATEGORIA.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.tipo && (
              <p className="text-xs text-destructive">{errors.tipo.message}</p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="presupuesto">Presupuesto mensual</Label>
              <Input
                id="presupuesto"
                type="number"
                step="0.01"
                min={0}
                {...register("presupuestoMensual", { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.presupuestoMensual && (
                <p className="text-xs text-destructive">
                  {errors.presupuestoMensual.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="presup-moneda">Moneda</Label>
              <Controller
                control={control}
                name="presupuestoMoneda"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger id="presup-moneda">
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
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              {...register("notas")}
              rows={2}
              placeholder="Ej: Alquiler, comunidad, IBI..."
              disabled={loading}
            />
          </div>

          <DialogFooter>
            {modal && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={loading} data-tour="category-form-submit">
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
