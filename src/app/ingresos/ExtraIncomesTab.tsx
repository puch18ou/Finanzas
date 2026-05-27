"use client";

/**
 * src/app/ingresos/ExtraIncomesTab.tsx
 *
 * Tabla de ingresos puntuales del año seleccionado. CRUD completo,
 * similar al de Gastos pero sin selector de mes (todo el año a la vez).
 */

import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useExtraIncomes } from "@/hooks/useExtraIncomes";
import { useCurrencies, useSettings } from "@/hooks/useSettings";
import { ExtraIncomeFormDialog } from "@/components/forms/ExtraIncomeFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExtraIncome } from "@/lib/db/schema";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { formatDateLong } from "@/lib/utils/dates";

type Props = {
  anio: number;
  monedaLocal: string;
};

export function ExtraIncomesTab({ anio, monedaLocal: _monedaLocal }: Props) {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const {
    extras,
    isLoading,
    create,
    update,
    remove,
    isMutating,
  } = useExtraIncomes({ anio });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExtraIncome | null>(null);
  const [toDelete, setToDelete] = useState<ExtraIncome | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const totalView = useMemo(
    () =>
      extras.reduce((acc, e) => {
        try {
          return acc + convert(e.importe, e.moneda, viewCurrency, rates);
        } catch {
          return acc;
        }
      }, 0),
    [extras, rates, viewCurrency],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Ingresos puntuales {anio}</CardTitle>
          <CardDescription>
            {isLoading
              ? "Cargando..."
              : `${extras.length} ingresos puntuales en ${anio}`}
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Anadir ingreso
        </Button>
      </CardHeader>
      <CardContent>
        {!isLoading && extras.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay ingresos puntuales para {anio}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">En {viewCurrency}</TableHead>
                <TableHead className="w-[90px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extras.map((e) => {
                const fecha = e.fecha instanceof Date ? e.fecha : new Date(e.fecha);
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
                    <TableCell className="font-medium">{e.concepto}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.categoria}</Badge>
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
                <TableCell colSpan={4} className="text-right font-medium">
                  Total anual en {viewCurrency}:
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

      <ExtraIncomeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        monedaLocal={settings?.monedaLocal ?? "EUR"}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            await update({ id: editing.id, patch: data });
          } else {
            await create({
              fecha: data.fecha,
              concepto: data.concepto,
              categoria: data.categoria,
              tipo: data.tipo,
              importe: data.importe,
              moneda: data.moneda,
              notas: data.notas ?? null,
            });
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar ingreso puntual"
        description={
          toDelete
            ? `El ingreso "${toDelete.concepto}" por ${formatAmount(toDelete.importe, toDelete.moneda)} pasara a la papelera.`
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
    </Card>
  );
}
