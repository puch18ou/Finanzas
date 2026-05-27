"use client";

/**
 * ============================================================================
 *  src/app/categorias/page.tsx
 * ============================================================================
 *
 *  Pantalla CRUD de categorias. Estructura:
 *
 *    [Header: titulo + boton "Anadir categoria"]
 *    [Tabla con filas: nombre, tipo, presupuesto, acciones (Editar/Borrar)]
 *    [Dialog modal de form (compartido para crear y editar)]
 *    [AlertDialog de confirmacion de borrado]
 *
 *  Patron de estado:
 *
 *    formOpen      → si el dialog del form esta abierto
 *    editing       → la fila que estamos editando (null = creando nueva)
 *    toDelete      → la fila que se quiere borrar (null = nadie)
 *
 *  Los hooks de TanStack Query (useCategories) hacen el resto: lectura,
 *  invalidacion, toasts.
 * ============================================================================
 */

import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { CategoryFormDialog } from "@/components/forms/CategoryFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
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
import type { Category } from "@/lib/db/schema";
import { formatAmount } from "@/lib/domain/currency";

export default function CategoriasPage() {
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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  if (!settings || isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando categorias...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            Define las categorias de gasto y sus presupuestos mensuales.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Anadir categoria
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            {categories.length} categorias activas. Los gastos se siguen
            conservando aunque borres una categoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay categorias todavia. Pulsa "Anadir categoria" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Presupuesto mensual</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.presupuestoMensual > 0
                        ? formatAmount(c.presupuestoMensual, c.presupuestoMoneda)
                        : <span className="text-muted-foreground">—</span>}
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
                          aria-label="Borrar"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        monedaLocal={settings.monedaLocal}
        currencies={currencies}
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
            ? `La categoria "${toDelete.nombre}" pasara a la papelera. Los gastos asociados se conservan.`
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
