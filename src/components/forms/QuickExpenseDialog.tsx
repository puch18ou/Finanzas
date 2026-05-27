"use client";

/**
 * ============================================================================
 *  src/components/forms/QuickExpenseDialog.tsx
 * ============================================================================
 *
 *  Modal "rapido" para anadir un gasto. Variante minimalista del formulario
 *  completo:
 *
 *    - Fecha: input nativo type=date (rapido, sin abrir popover)
 *    - Concepto
 *    - Categoria
 *    - Importe + moneda
 *
 *  No tiene cuenta ni notas. Si el usuario los quiere, editara despues
 *  desde la pagina de Gastos. El objetivo es la velocidad.
 *
 *  Por defecto, fecha = hoy y moneda = moneda local del usuario.
 *  Tras enviar, NO cierra el modal por defecto: limpia el formulario y
 *  deja el foco en "concepto" para anadir varios seguidos. (Se puede
 *  cerrar con Esc o pulsando fuera).
 *
 *  Ahora bien, si el usuario marca el checkbox "Cerrar tras anadir", si
 *  cierra. Es un toggle persistente en localStorage para que recuerde
 *  la preferencia.
 *
 *  ATENCION: localStorage NO es soportado por algunos entornos de
 *  artefactos pero SI por Tauri/Next dev. Aqui lo usamos sin problema.
 * ============================================================================
 */

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  quickExpenseFormSchema,
  type QuickExpenseFormData,
} from "@/lib/schemas/forms";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useExpenses } from "@/hooks/useExpenses";
import { formatDateOnlyString, parseDateOnlyString } from "@/lib/utils/dates";
import { Zap } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STORAGE_KEY = "quickadd:closeAfterSave";

export function QuickExpenseDialog({ open, onOpenChange }: Props) {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { create, isMutating } = useExpenses();

  // Preferencia "cerrar tras guardar", persistente
  const [closeAfter, setCloseAfter] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      setCloseAfter(v === "true");
    } catch {
      // localStorage podria estar bloqueado, no rompemos
    }
  }, []);
  const updateCloseAfter = (v: boolean) => {
    setCloseAfter(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(v));
    } catch {}
  };

  const today = formatDateOnlyString(new Date());

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
    setFocus,
  } = useForm<QuickExpenseFormData>({
    resolver: zodResolver(quickExpenseFormSchema),
    defaultValues: {
      fecha: today,
      concepto: "",
      categoriaId: "",
      importe: 0,
      moneda: settings?.monedaLocal ?? "EUR",
    },
  });

  // Cuando se abre el modal, resetear con defaults frescos
  useEffect(() => {
    if (open && settings) {
      reset({
        fecha: today,
        concepto: "",
        categoriaId: "",
        importe: 0,
        moneda: settings.monedaLocal,
      });
      // Foco en concepto despues de un tick para que el DOM este montado
      setTimeout(() => setFocus("concepto"), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings?.monedaLocal]);

  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await create({
        fecha: parseDateOnlyString(data.fecha),
        concepto: data.concepto,
        categoriaId: data.categoriaId,
        importe: data.importe,
        moneda: data.moneda,
        cuentaId: null,
        notas: null,
      });

      if (closeAfter) {
        onOpenChange(false);
      } else {
        // Limpia campos pero conserva fecha y moneda elegidas
        reset({
          fecha: data.fecha,
          concepto: "",
          categoriaId: data.categoriaId,
          importe: 0,
          moneda: data.moneda,
        });
        setTimeout(() => setFocus("concepto"), 30);
      }
    } catch {
      // toast ya mostrado
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Anadido rapido
          </DialogTitle>
          <DialogDescription>
            Registra un gasto en segundos.{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              Ctrl+Shift+G
            </kbd>{" "}
            abre y cierra esta ventana.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-fecha">Fecha</Label>
              <Input
                id="qa-fecha"
                type="date"
                {...register("fecha")}
                disabled={isMutating}
              />
              {errors.fecha && (
                <p className="text-xs text-destructive">{errors.fecha.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-concepto">Concepto</Label>
              <Input
                id="qa-concepto"
                {...register("concepto")}
                placeholder="Cafe en el bar..."
                disabled={isMutating}
                autoComplete="off"
              />
              {errors.concepto && (
                <p className="text-xs text-destructive">{errors.concepto.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-categoria">Categoria</Label>
            <Controller
              control={control}
              name="categoriaId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isMutating}
                >
                  <SelectTrigger id="qa-categoria">
                    <SelectValue placeholder="Selecciona una categoria" />
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

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-importe">Importe</Label>
              <Input
                id="qa-importe"
                type="number"
                step="0.01"
                min={0}
                {...register("importe", { valueAsNumber: true })}
                disabled={isMutating}
              />
              {errors.importe && (
                <p className="text-xs text-destructive">{errors.importe.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-moneda">Moneda</Label>
              <Controller
                control={control}
                name="moneda"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isMutating}
                  >
                    <SelectTrigger id="qa-moneda">
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

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="qa-close"
              checked={closeAfter}
              onChange={(e) => updateCloseAfter(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="qa-close" className="text-xs font-normal text-muted-foreground">
              Cerrar tras guardar
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMutating}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={isMutating}>
              {isMutating ? "Guardando..." : "Anadir gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
