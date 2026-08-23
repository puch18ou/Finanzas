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
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  CalendarClock,
} from "lucide-react";
import { useCategories, useCategoriesUsage } from "@/hooks/useCategories";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { resolvePresupuesto } from "@/lib/domain/tramos";
import { CategoryFormDialog } from "@/components/forms/CategoryFormDialog";
import { PresupuestoTramosDialog } from "@/components/forms/PresupuestoTramosDialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Category } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import {
  sumMovementsByCategory,
  filterMovementsByPeriod,
} from "@/lib/domain/aggregation";

export default function CategoriasPage() {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const {
    categories,
    isLoading,
    create,
    update,
    remove,
    reorder,
    isMutating,
  } = useCategories();
  const { inUse: categoriasEnUso } = useCategoriesUsage();

  // Siempre el mes ACTUAL al arrancar (no se persiste).
  const [periodAnio, setPeriodAnio] = useState<number>(today.getFullYear());
  const [periodMes, setPeriodMes] = useState<number>(today.getMonth() + 1);

  const { movements } = useMovements({ anio: periodAnio, mes: periodMes });
  const { tramos: presupuestoTramos } = usePresupuestoTramos();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [tramosCat, setTramosCat] = useState<Category | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const gastosPorCategoria = useMemo(() => {
    const filtered = filterMovementsByPeriod(movements, periodMes, periodAnio);
    return sumMovementsByCategory(filtered, rates, viewCurrency);
  }, [movements, periodMes, periodAnio, rates, viewCurrency]);

  // Cambios de presupuesto agrupados por categoria (la base vive en la propia
  // categoria; estos son solo los cambios con fecha).
  const tramosByCat = useMemo(() => {
    const m: Record<string, typeof presupuestoTramos> = {};
    for (const t of presupuestoTramos) {
      (m[t.categoriaId] ??= []).push(t);
    }
    return m;
  }, [presupuestoTramos]);

  const moveCategory = async (id: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    const a = next[idx]!;
    const b = next[target]!;
    next[idx] = b;
    next[target] = a;
    await reorder(next.map((c) => c.id));
  };

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
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
            data-tour="cat-nueva"
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
                  <TableHead className="w-[200px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c, idx) => {
                  const gastado = gastosPorCategoria[c.id] ?? 0;
                  // Presupuesto vigente en el periodo: base de la categoria o
                  // el ultimo cambio con fecha <= periodo.
                  const presup = resolvePresupuesto(
                    tramosByCat[c.id] ?? [],
                    c.presupuestoMensual,
                    c.presupuestoMoneda,
                    periodAnio,
                    periodMes,
                  );
                  const tieneCambios = (tramosByCat[c.id] ?? []).length > 0;
                  let presupuestoView = 0;
                  if (presup.importe > 0) {
                    try {
                      presupuestoView = convert(
                        presup.importe,
                        presup.moneda,
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
                        {money(gastado, viewCurrency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {presupuestoView > 0
                          ? money(presupuestoView, viewCurrency)
                          : "—"}
                        {tieneCambios && (
                          <span
                            className="ml-1 text-xs text-muted-foreground"
                            title="Tiene cambios de presupuesto con fecha"
                          >
                            ⏱
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        {presupuestoView > 0 ? (
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
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategory(c.id, -1)}
                            disabled={idx === 0 || isMutating}
                            aria-label="Subir"
                            className="h-8 w-8"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategory(c.id, 1)}
                            disabled={idx === categories.length - 1 || isMutating}
                            aria-label="Bajar"
                            className="h-8 w-8"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTramosCat(c)}
                            aria-label="Cambios de presupuesto"
                            title="Cambios de presupuesto con fecha"
                            className="h-8 w-8"
                            data-tour="cat-tramos"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                            className="h-8 w-8"
                            data-tour="cat-editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setToDelete(c)}
                                  disabled={categoriasEnUso.has(c.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  aria-label="Borrar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {categoriasEnUso.has(c.id)
                                ? "En uso (tiene movimientos o reglas): solo se puede editar"
                                : "Borrar"}
                            </TooltipContent>
                          </Tooltip>
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

      <PresupuestoTramosDialog
        open={!!tramosCat}
        onOpenChange={(v) => !v && setTramosCat(null)}
        category={tramosCat}
        currencies={currencies}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar categoria"
        description={
          toDelete
            ? `"${toDelete.nombre}" pasara a la papelera. Solo se pueden borrar categorias sin movimientos ni reglas.`
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
    </TooltipProvider>
  );
}
