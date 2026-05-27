"use client";

/**
 * src/app/cuentas/page.tsx
 *
 * CRUD de cuentas. Mismo patron que Categorias pero con:
 *  - Columna extra "Equivalente" (saldo convertido a moneda vista)
 *  - Total al pie en moneda vista (suma de todas las cuentas activas)
 *  - Las inactivas se ven en gris claro
 */

import { useState } from "react";
import { Pencil, Trash2, Plus, Landmark } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { AccountFormDialog } from "@/components/forms/AccountFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
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
import type { Account } from "@/lib/db/schema";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";

export default function CuentasPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, isLoading, create, update, remove, isMutating } = useAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  if (!settings || isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando cuentas...</p>;
  }

  const rates = buildRatesMap(currencies);
  const viewCurrency = settings.monedaVista;

  // Total en moneda vista, solo de cuentas ACTIVAS.
  const totalEnVista = accounts
    .filter((a) => a.activa)
    .reduce((acc, a) => {
      try {
        return acc + convert(a.saldo, a.moneda, viewCurrency, rates);
      } catch {
        return acc;
      }
    }, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas bancarias, broker y efectivo. Saldos en moneda nativa y
            convertidos a {viewCurrency}.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Anadir cuenta
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Listado de cuentas
            </span>
          </CardTitle>
          <CardDescription>
            {accounts.length} cuentas totales — {accounts.filter((a) => a.activa).length} activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay cuentas todavia. Pulsa "Anadir cuenta" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Equivalente</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  let equivalente: number | null = null;
                  try {
                    equivalente = convert(a.saldo, a.moneda, viewCurrency, rates);
                  } catch {
                    equivalente = null;
                  }
                  const dim = !a.activa ? "opacity-50" : "";
                  return (
                    <TableRow key={a.id} className={dim}>
                      <TableCell className="font-medium">{a.alias}</TableCell>
                      <TableCell>{a.entidad}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.tipo}</Badge>
                        {!a.activa && (
                          <Badge variant="outline" className="ml-1">inactiva</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(a.saldo, a.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {equivalente !== null
                          ? a.moneda === viewCurrency
                            ? "—"
                            : formatAmount(equivalente, viewCurrency)
                          : <span className="text-destructive">err</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(a);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(a)}
                            aria-label="Borrar"
                            className="text-destructive hover:text-destructive"
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
                    Total cuentas activas en {viewCurrency}:
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatAmount(totalEnVista, viewCurrency)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccountFormDialog
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
        title="Borrar cuenta"
        description={
          toDelete
            ? `La cuenta "${toDelete.alias}" pasara a la papelera. Los gastos asociados se conservan.`
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
