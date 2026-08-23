"use client";

/**
 * src/app/cuentas/page.tsx
 *
 * CRUD de cuentas. Mismo patron que Categorias pero con:
 *  - Columna extra "Equivalente" (saldo convertido a moneda vista)
 *  - Total al pie en moneda vista (suma de todas las cuentas activas)
 *  - Las inactivas se ven en gris claro
 */

import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Landmark,
  Scale,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  useAccounts,
  useAccountBalances,
  useAccountsUsage,
} from "@/hooks/useAccounts";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { AccountFormDialog } from "@/components/forms/AccountFormDialog";
import { ReconcileAccountDialog } from "@/components/forms/ReconcileAccountDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { normalizeDateToUTCNoon } from "@/lib/utils/dates";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Account } from "@/lib/db/schema";
import type { AccountFormData } from "@/lib/schemas/forms";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { useDemoForm, useDemo } from "@/contexts/DemoProvider";

export default function CuentasPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, isLoading, create, update, remove, isMutating } = useAccounts();
  const { balances } = useAccountBalances();
  const { inUse: cuentasEnUso } = useAccountsUsage();
  const {
    movements: allMovs,
    create: createMovement,
    isMutating: isReconciling,
  } = useMovements();
  const mask = useMaskMoney();

  // Deteccion "en uso" a partir de los movimientos reales (los mismos que dan
  // el saldo): mas fiable que depender solo del servicio. Se combina con el
  // servicio (que ademas cubre reglas recurrentes).
  const cuentasConMov = useMemo(() => {
    const s = new Set<string>();
    for (const m of allMovs) {
      if (m.cuentaOrigenId) s.add(m.cuentaOrigenId);
      if (m.cuentaDestinoId) s.add(m.cuentaDestinoId);
    }
    return s;
  }, [allMovs]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [toReconcile, setToReconcile] = useState<Account | null>(null);
  const [demoPrefill, setDemoPrefill] = useState<Partial<AccountFormData> | null>(
    null,
  );

  // El demo pide abrir el formulario de cuenta ya rellenado para explicarlo.
  const demoForm = useDemoForm();
  const { running: demoRunning } = useDemo();
  useEffect(() => {
    if (demoForm.req?.name === "account") {
      setEditing(null);
      setDemoPrefill(demoForm.req.values as Partial<AccountFormData>);
      setFormOpen(true);
    }
  }, [demoForm.req]);

  if (!settings || isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando cuentas...</p>;
  }

  const rates = buildRatesMap(currencies);
  const viewCurrency = settings.monedaVista;
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));

  const saldoDe = (a: Account) => balances.get(a.id) ?? 0;

  // Conciliacion: crea un movimiento de ajuste por la diferencia entre el
  // saldo real introducido y el calculado.
  const handleReconcile = async (saldoReal: number) => {
    if (!toReconcile) return;
    const actual = saldoDe(toReconcile);
    const diff = Math.round((saldoReal - actual) * 100) / 100;
    if (diff === 0) {
      setToReconcile(null);
      return;
    }
    const fecha = normalizeDateToUTCNoon(new Date());
    await createMovement({
      tipo: "ajuste",
      fecha,
      concepto: "Conciliacion de saldo",
      importe: Math.abs(diff),
      moneda: toReconcile.moneda,
      cuentaOrigenId: diff < 0 ? toReconcile.id : null,
      cuentaDestinoId: diff > 0 ? toReconcile.id : null,
      categoriaId: null,
      categoriaTexto: "Ajuste",
      mes: fecha.getUTCMonth() + 1,
      anio: fecha.getUTCFullYear(),
      notas: `Ajuste por conciliacion (saldo real ${saldoReal} ${toReconcile.moneda})`,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    setToReconcile(null);
  };

  // Total en moneda vista, solo de cuentas ACTIVAS.
  const totalEnVista = accounts
    .filter((a) => a.activa)
    .reduce((acc, a) => {
      try {
        return acc + convert(saldoDe(a), a.moneda, viewCurrency, rates);
      } catch {
        return acc;
      }
    }, 0);

  return (
    <TooltipProvider delayDuration={200}>
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
          data-tour="cuentas-nueva"
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
            <Table data-tour="cuentas-tabla">
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Equivalente</TableHead>
                  <TableHead className="w-[180px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  const saldo = saldoDe(a);
                  let equivalente: number | null = null;
                  try {
                    equivalente = convert(saldo, a.moneda, viewCurrency, rates);
                  } catch {
                    equivalente = null;
                  }
                  const dim = !a.activa ? "opacity-50" : "";
                  const enUso = cuentasConMov.has(a.id) || cuentasEnUso.has(a.id);
                  const saldoCero = Math.abs(saldo) < 0.005;
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
                        {money(saldo, a.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {equivalente !== null
                          ? a.moneda === viewCurrency
                            ? "—"
                            : money(equivalente, viewCurrency)
                          : <span className="text-destructive">err</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToReconcile(a)}
                            aria-label="Conciliar"
                            title="Conciliar saldo"
                            data-tour="cuentas-conciliar"
                          >
                            <Scale className="h-4 w-4" />
                          </Button>
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
                          {a.activa ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!saldoCero}
                                    onClick={() =>
                                      update({
                                        id: a.id,
                                        patch: { activa: false },
                                      })
                                    }
                                    aria-label="Archivar"
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {saldoCero
                                  ? "Archivar (cerrar) la cuenta"
                                  : "Pon el saldo a 0 para poder archivarla"}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    update({ id: a.id, patch: { activa: true } })
                                  }
                                  aria-label="Reactivar"
                                >
                                  <ArchiveRestore className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reactivar la cuenta</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setToDelete(a)}
                                  disabled={enUso}
                                  aria-label="Borrar"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {enUso
                                ? "Tiene movimientos: archívala en vez de borrarla"
                                : "Borrar"}
                            </TooltipContent>
                          </Tooltip>
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
                    {money(totalEnVista, viewCurrency)}
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
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setDemoPrefill(null);
            demoForm.clear();
          }
        }}
        initial={editing}
        monedaLocal={settings.monedaLocal}
        currencies={currencies}
        loading={isMutating}
        prefill={demoPrefill ?? undefined}
        modal={demoRunning ? false : undefined}
        onSubmit={async (data) => {
          if (editing) {
            await update({ id: editing.id, patch: data });
          } else {
            await create(data);
          }
        }}
      />

      <ReconcileAccountDialog
        open={!!toReconcile}
        onOpenChange={(v) => !v && setToReconcile(null)}
        account={toReconcile}
        saldoActual={toReconcile ? saldoDe(toReconcile) : 0}
        loading={isReconciling}
        onConfirm={handleReconcile}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar cuenta"
        description={
          toDelete
            ? `La cuenta "${toDelete.alias}" pasara a la papelera. Solo se pueden borrar cuentas sin movimientos; si los tiene, archívala.`
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
