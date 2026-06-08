"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { movementKind, movKindColor, movKindSign } from "../movement-display";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MovementFormDialog } from "@/components/forms/MovementFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import type { Movement } from "@/lib/db/schema";
import type { CreateMovementData } from "@/lib/repositories";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MobileMovements() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const view = settings?.monedaVista ?? "EUR";
  const now = new Date();
  const baseMes = settings?.mesActual ?? now.getMonth() + 1;
  const baseAnio = settings?.anioActual ?? now.getFullYear();

  const [offset, setOffset] = useState(0);
  // mes/anio objetivo aplicando el desplazamiento.
  const idx = baseAnio * 12 + (baseMes - 1) + offset;
  const anio = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;

  const { movements, update, remove, isMutating } = useMovements({ anio, mes });
  const rates = buildRatesMap(currencies);

  // Edicion / borrado
  const [editing, setEditing] = useState<Movement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Movement | null>(null);

  const handleSubmit = async (data: CreateMovementData) => {
    if (editing) await update({ id: editing.id, patch: data });
    setFormOpen(false);
    setEditing(null);
  };

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.nombre]));
    return (m: { categoriaId: string | null; categoriaTexto: string | null }) =>
      (m.categoriaId && map.get(m.categoriaId)) || m.categoriaTexto || "";
  }, [categories]);

  const lista = [...movements].sort(
    (a, b) => +new Date(b.fecha) - +new Date(a.fecha),
  );

  return (
    <MobileScreen
      title="Movimientos"
      action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-24 text-center text-xs font-medium">
            {MESES[mes - 1]} {anio}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos este mes.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {lista.map((m) => {
              const kind = movementKind(m.tipo);
              const importe = convert(m.importe, m.moneda, view, rates);
              const cat = catName(m);
              return (
                <div key={m.id} className="flex items-center gap-1 pr-1">
                  {/* Toque en la fila -> editar */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(m);
                      setFormOpen(true);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.concepto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(m.fecha).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {cat ? ` · ${cat}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${movKindColor(kind)}`}>
                      {movKindSign(kind)}
                      {formatMoney(importe, view)}
                    </span>
                  </button>
                  {/* Borrar */}
                  <button
                    type="button"
                    onClick={() => setToDelete(m)}
                    aria-label="Borrar movimiento"
                    className="shrink-0 p-2 text-muted-foreground active:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <MovementFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        currencies={currencies}
        categories={categories}
        accounts={accounts}
        monedaLocal={settings?.monedaLocal ?? "EUR"}
        defaultAccountId={settings?.cuentaPorDefectoId ?? null}
        loading={isMutating}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar movimiento"
        description={toDelete ? `"${toDelete.concepto}" pasara a la papelera.` : ""}
        loading={isMutating}
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.id);
            setToDelete(null);
          }
        }}
      />
    </MobileScreen>
  );
}
