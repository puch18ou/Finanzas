"use client";

/**
 * ============================================================================
 *  src/app/gastos/page.tsx
 * ============================================================================
 *
 *  Pagina principal de Gastos. Estructura:
 *
 *    [Header con titulo + PeriodSelector + boton "Anadir gasto"]
 *    [Card con filtros: categoria, cuenta, busqueda]
 *    [Tabla con los gastos del periodo + total en pie]
 *    [Modal de form (compartido crear/editar)]
 *    [AlertDialog de borrado]
 *
 *  Al abrir, pre-filtra al periodo activo definido en Ajustes. El usuario
 *  puede cambiar de mes con el PeriodSelector sin afectar a Ajustes.
 *
 *  CONVERSION DE IMPORTES
 *  ----------------------
 *  Cada gasto se muestra en su moneda original. En una columna extra
 *  mostramos su equivalente en moneda vista. Al pie sumamos todo el
 *  total en moneda vista usando la capa de dominio (convert + sum).
 * ============================================================================
 */

import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Search, X } from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { ExpenseFormDialog } from "@/components/forms/ExpenseFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Expense } from "@/lib/db/schema";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { formatDateLong } from "@/lib/utils/dates";

const ALL = "__all__";

export default function GastosPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  // Estado local de filtros (no global)
  const [anio, setAnio] = useState<number>(settings?.anioActual ?? new Date().getFullYear());
  const [mes, setMes] = useState<number>(settings?.mesActual ?? new Date().getMonth() + 1);
  const [categoriaId, setCategoriaId] = useState<string>(ALL);
  const [cuentaId, setCuentaId] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const filter = {
    anio,
    mes,
    categoriaId: categoriaId === ALL ? undefined : categoriaId,
    cuentaId: cuentaId === ALL ? undefined : cuentaId,
    search: search.trim() || undefined,
  };
  const {
    expenses,
    isLoading,
    isFetching,
    create,
    update,
    remove,
    isMutating,
  } = useExpenses(filter);

  // CRUD UI state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  // Look-ups rapidos por id (para mostrar nombre de categoria/cuenta en la tabla)
  const categoryById = useMemo(() => {
    const m: Record<string, { nombre: string; tipo: string }> = {};
    for (const c of categories) m[c.id] = { nombre: c.nombre, tipo: c.tipo };
    return m;
  }, [categories]);
  const accountById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.alias;
    return m;
  }, [accounts]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const totalView = useMemo(
    () =>
      expenses.reduce((acc, e) => {
        try {
          return acc + convert(e.importe, e.moneda, viewCurrency, rates);
        } catch {
          return acc;
        }
      }, 0),
    [expenses, rates, viewCurrency],
  );

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            Registro detallado de gastos del periodo seleccionado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            anio={anio}
            mes={mes}
            onChange={({ anio: a, mes: m }) => {
              setAnio(a);
              setMes(m);
            }}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Anadir gasto
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-categoria" className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger id="f-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-cuenta" className="text-xs">Cuenta</Label>
              <Select value={cuentaId} onValueChange={setCuentaId}>
                <SelectTrigger id="f-cuenta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-search" className="text-xs">Buscar en concepto</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="f-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="cafe, alquiler..."
                  className="pl-8 pr-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar busqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>
            {isLoading
              ? "Cargando gastos..."
              : `${expenses.length} gastos en el periodo`}
            {isFetching && !isLoading && " (actualizando...)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay gastos para los filtros actuales. Pulsa "Anadir gasto" o usa{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                Ctrl+Shift+G
              </kbd>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right">En {viewCurrency}</TableHead>
                  <TableHead className="w-[90px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => {
                  const fecha =
                    e.fecha instanceof Date ? e.fecha : new Date(e.fecha);
                  const cat = categoryById[e.categoriaId];
                  let inView: number | null = null;
                  try {
                    inView = convert(e.importe, e.moneda, viewCurrency, rates);
                  } catch {
                    inView = null;
                  }
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateLong(fecha)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {e.concepto}
                        {e.notas && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {e.notas}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <Badge variant="secondary">{cat.nombre}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            (eliminada)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.cuentaId ? accountById[e.cuentaId] ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(e.importe, e.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.moneda === viewCurrency
                          ? "—"
                          : inView !== null
                          ? formatAmount(inView, viewCurrency)
                          : "err"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(e);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(e)}
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
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Total del periodo en {viewCurrency}:
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatAmount(totalView, viewCurrency)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        categories={categories}
        accounts={accounts}
        currencies={currencies}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            await update({ id: editing.id, patch: data });
          } else {
            await create({
              fecha: data.fecha,
              concepto: data.concepto,
              categoriaId: data.categoriaId,
              importe: data.importe,
              moneda: data.moneda,
              cuentaId: data.cuentaId ?? null,
              notas: data.notas ?? null,
            });
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar gasto"
        description={
          toDelete
            ? `El gasto "${toDelete.concepto}" por ${formatAmount(
                toDelete.importe,
                toDelete.moneda,
              )} pasara a la papelera.`
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
