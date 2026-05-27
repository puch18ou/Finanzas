"use client";

/**
 * src/app/categorias/page.tsx — Categorias
 *
 * Lote 10a-2: la columna "Gasto este mes" lee de `movements` en lugar
 * de expenses. La logica de CRUD de categorias no cambia.
 *
 * NOTA: este archivo asume el formato actual de tu pantalla de
 * Categorias. Si hicieste cambios visuales personalizados que no son
 * estandar, comparalo con tu version actual y conserva los detalles
 * propios. Lo que importa cambiar es la fuente: useExpenses -> useMovements
 * y sumExpensesByCategory -> sumMovementsByCategory.
 */

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { CategoryFormDialog } from "@/components/forms/CategoryFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Category } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import {
  sumMovementsByCategory,
  filterMovementsByPeriod,
} from "@/lib/domain/aggregation";

export default function CategoriasPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const {
    categories,
    isLoading,
    create,
    update,
    remove,
    isMutating,
  } = useCategories();

  const [periodAnio, setPeriodAnio] = useLocalStorage<number>(
    "categorias:anio",
    settings?.anioActual ?? today.getFullYear(),
  );
  const [periodMes, setPeriodMes] = useLocalStorage<number>(
    "categorias:mes",
    settings?.mesActual ?? today.getMonth() + 1,
  );

  const { movements } = useMovements({ anio: periodAnio, mes: periodMes });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const gastosPorCategoria = useMemo(() => {
    const filtered = filterMovementsByPeriod(movements, periodMes, periodAnio);
    return sumMovementsByCategory(filtered, rates, viewCurrency);
  }, [movements, periodMes, periodAnio, rates, viewCurrency]);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            Organiza tus gastos por categoria con presupuesto opcional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            anio={periodAnio}
            mes={periodMes}
            onChange={({ anio, mes }) => {
              setPeriodAnio(anio);
              setPeriodMes(mes);
            }}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Categoria
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tus categorias ({categories.length})</CardTitle>
          <CardDescription>
            Gasto del periodo seleccionado en {viewCurrency}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aun no hay categorias. Pulsa "Categoria" para crear una.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Gastado</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => {
                  const gastado = gastosPorCategoria[c.id] ?? 0;
                  let presupuestoView = 0;
                  if (c.presupuestoMensual > 0) {
                    try {
                      presupuestoView = convert(
                        c.presupuestoMensual,
                        c.presupuestoMoneda,
                        viewCurrency,
                        rates,
                      );
                    } catch {
                      presupuestoView = 0;
                    }
                  }
                  const pct =
                    presupuestoView > 0
                      ? Math.min(100, (gastado / presupuestoView) * 100)
                      : 0;
                  const overBudget = presupuestoView > 0 && gastado > presupuestoView;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {c.color && (
                            <span
                              className="h-3 w-3 rounded-full border"
                              style={{ backgroundColor: c.color }}
                              aria-hidden
                            />
                          )}
                          {c.nombre}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(gastado, viewCurrency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.presupuestoMensual > 0
                          ? formatAmount(presupuestoView, viewCurrency)
                          : "—"}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        {c.presupuestoMensual > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={pct}
                              className={overBudget ? "bg-destructive/20" : ""}
                            />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin presupuesto</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(c)}
                            className="text-destructive hover:text-destructive"
                            aria-label="Borrar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            await update({ id: editing.id, patch: data });
          } else {
            await create(data);
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar categoria"
        description={
          toDelete
            ? `"${toDelete.nombre}" pasara a la papelera. Los gastos que la usaban mantendran la referencia.`
            : ""
        }
        loading={isMutating}
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.id);
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}
