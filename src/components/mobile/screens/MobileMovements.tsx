"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Undo2 } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { useMovementEditor } from "../MobileMovementEditor";
import { movementKind, movKindColor, movKindSign } from "../movement-display";
import { useMovements } from "@/hooks/useMovements";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useRefundTotals } from "@/hooks/useRefunds";
import { formatMoney } from "@/lib/utils/money";
import { buildRatesMap } from "@/lib/domain/currency";
import { costeReal, sumRefundsInCurrency } from "@/lib/domain/refunds";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { RefundsDialog } from "@/components/forms/RefundsDialog";
import type { Movement } from "@/lib/db/schema";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MobileMovements() {
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { data: refundsByGasto = {} } = useRefundTotals();
  const editor = useMovementEditor();

  const now = new Date();
  const baseMes = now.getMonth() + 1;
  const baseAnio = now.getFullYear();

  const [offset, setOffset] = useState(0);
  // mes/anio objetivo aplicando el desplazamiento.
  const idx = baseAnio * 12 + (baseMes - 1) + offset;
  const anio = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;

  const { movements, remove, isMutating } = useMovements({ anio, mes });

  const [toDelete, setToDelete] = useState<Movement | null>(null);
  const [refundsFor, setRefundsFor] = useState<Movement | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const accById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.alias;
    return map;
  }, [accounts]);

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
              const cat = catName(m);
              const esGasto = m.tipo === "gasto" || m.tipo === "cuota";
              const totalDevuelto = esGasto
                ? sumRefundsInCurrency(refundsByGasto[m.id] ?? [], m.moneda, rates)
                : 0;
              return (
                <div key={m.id} className="flex items-center gap-1 pr-1">
                  {/* Toque en la fila -> editar */}
                  <button
                    type="button"
                    onClick={() => editor.openEdit(m)}
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
                    <div className="shrink-0 text-right">
                      <span className={`text-sm font-semibold ${movKindColor(kind)}`}>
                        {movKindSign(kind)}
                        {formatMoney(m.importe, m.moneda)}
                      </span>
                      {esGasto && totalDevuelto > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          real {formatMoney(costeReal(m.importe, totalDevuelto), m.moneda)}
                        </p>
                      )}
                    </div>
                  </button>
                  {/* Devoluciones (solo gastos) */}
                  {esGasto && (
                    <button
                      type="button"
                      onClick={() => setRefundsFor(m)}
                      aria-label="Devoluciones"
                      className="shrink-0 p-2 text-muted-foreground active:text-foreground"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
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

      <RefundsDialog
        open={!!refundsFor}
        onOpenChange={(v) => !v && setRefundsFor(null)}
        gasto={refundsFor}
        accounts={accounts}
        accById={accById}
        currencies={currencies}
        defaultAccountId={settings?.cuentaPorDefectoId ?? null}
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
