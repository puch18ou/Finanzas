"use client";

/**
 * ============================================================================
 *  src/components/forms/PresupuestoTramosDialog.tsx
 * ============================================================================
 *
 *  Editor de los CAMBIOS con fecha del presupuesto de una categoria. El valor
 *  base ("desde siempre") se edita en el formulario de la categoria; aqui solo
 *  se anaden cambios "a partir de tal mes el presupuesto pasa a ser X".
 *
 *  Para un mes dado aplica el cambio mas reciente <= ese mes; si no hay ninguno,
 *  el presupuesto base de la categoria (ver domain/tramos.resolvePresupuesto).
 * ============================================================================
 */

import { Plus, Trash2 } from "lucide-react";
import type { Category, Currency } from "@/lib/db/schema";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { ordenarTramos, resolvePresupuesto } from "@/lib/domain/tramos";
import { formatAmount } from "@/lib/domain/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PresupuestoTramosDialog({
  open,
  onOpenChange,
  category,
  currencies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  currencies: Currency[];
}) {
  const { tramos, create, update, remove } = usePresupuestoTramos();

  const hoy = new Date();
  const delaCat = category
    ? ordenarTramos(tramos.filter((t) => t.categoriaId === category.id))
    : [];

  async function handleAdd() {
    if (!category) return;
    // Valor de partida = presupuesto vigente este mes (base o ultimo cambio).
    const vigente = resolvePresupuesto(
      tramos.filter((t) => t.categoriaId === category.id),
      category.presupuestoMensual,
      category.presupuestoMoneda,
      hoy.getFullYear(),
      hoy.getMonth() + 1,
    );
    await create({
      categoriaId: category.id,
      desdeAnio: hoy.getFullYear(),
      desdeMes: hoy.getMonth() + 1,
      importe: vigente.importe,
      moneda: vigente.moneda,
    });
  }

  function persistDesde(id: string, value: string) {
    if (!value) return; // un cambio siempre tiene fecha
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return;
    void update({ id, patch: { desdeAnio: y, desdeMes: m } });
  }

  function persistImporte(id: string, value: string) {
    const n = Number(value);
    void update({ id, patch: { importe: isNaN(n) || n < 0 ? 0 : n } });
  }

  function persistMoneda(id: string, moneda: string) {
    void update({ id, patch: { moneda } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Cambios de presupuesto{category ? ` · ${category.nombre}` : ""}
          </DialogTitle>
          <DialogDescription>
            Base (desde siempre):{" "}
            {category
              ? formatAmount(
                  category.presupuestoMensual,
                  category.presupuestoMoneda,
                )
              : "—"}
            . Edita la base en la categoria. Anade aqui cambios a partir de un
            mes; cada uno aplica hasta el siguiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {delaCat.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin cambios. El presupuesto es el base en todos los meses.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_90px_auto] items-end gap-2 text-xs text-muted-foreground">
                <span>Desde</span>
                <span>Importe</span>
                <span>Moneda</span>
                <span />
              </div>
              {delaCat.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_1fr_90px_auto] items-center gap-2"
                >
                  <Input
                    type="month"
                    defaultValue={
                      t.desdeAnio && t.desdeMes
                        ? `${t.desdeAnio}-${String(t.desdeMes).padStart(2, "0")}`
                        : ""
                    }
                    onBlur={(e) => persistDesde(t.id, e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={t.importe}
                    onBlur={(e) => persistImporte(t.id, e.target.value)}
                  />
                  <Select
                    value={t.moneda}
                    onValueChange={(v) => persistMoneda(t.id, v)}
                  >
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar cambio"
                    onClick={() => void remove(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!category}
          >
            <Plus className="mr-1 h-4 w-4" />
            Anadir cambio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
