"use client";

/**
 * ============================================================================
 *  src/components/forms/ContributionsDialog.tsx — Aportaciones de una inversion
 * ============================================================================
 *
 *  Lista las aportaciones de una inversion y permite:
 *    - Anadir una aportacion puntual (fecha, participaciones, precio, cuenta de
 *      origen). Descuenta el importe de esa cuenta.
 *    - Borrar una aportacion, devolviendo el importe aportado a la cuenta que
 *      se elija (por defecto, la de origen).
 * ============================================================================
 */

import { useState } from "react";
import { Plus, Trash2, ArrowDownToLine } from "lucide-react";
import type { Account, Investment, InvestmentContribution } from "@/lib/db/schema";
import { useInvestmentContributions } from "@/hooks/useInvestmentContributions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/domain/currency";
import { usaParticipaciones } from "@/lib/domain/investments";
import {
  formatDateOnlyString,
  formatDateLong,
  normalizeDateToUTCNoon,
  parseDateOnlyString,
} from "@/lib/utils/dates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment | null;
  accounts: Account[];
};

export function ContributionsDialog({
  open,
  onOpenChange,
  investment,
  accounts,
}: Props) {
  const { contributions, add, withdraw, remove, isMutating } =
    useInvestmentContributions(investment?.id);
  const activeAccounts = accounts.filter((a) => a.activa);
  const aliasById = Object.fromEntries(accounts.map((a) => [a.id, a.alias]));

  // Formulario de "añadir"
  const [fecha, setFecha] = useState(formatDateOnlyString(new Date()));
  const [participaciones, setParticipaciones] = useState("");
  const [total, setTotal] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Retirada
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wCantidad, setWCantidad] = useState("");
  const [wTodo, setWTodo] = useState(false);
  const [wDestino, setWDestino] = useState("");
  const [wError, setWError] = useState<string | null>(null);

  // Borrado con devolución
  const [toDelete, setToDelete] = useState<InvestmentContribution | null>(null);
  const [refundAccountId, setRefundAccountId] = useState("");

  if (!investment) return null;

  // Modo participaciones (Acciones/ETF/Cripto) vs "solo dinero" (resto).
  const conParticipaciones = usaParticipaciones(investment.tipo);

  function resetAddForm() {
    setFecha(formatDateOnlyString(new Date()));
    setParticipaciones("");
    setTotal("");
    setCuentaOrigenId("");
    setAddError(null);
  }

  async function submitAdd() {
    if (!investment) return;
    const tot = Number(total);
    if (!Number.isFinite(tot) || tot <= 0) {
      setAddError("El importe debe ser mayor que 0.");
      return;
    }
    if (!cuentaOrigenId) {
      setAddError("Selecciona la cuenta de origen.");
      return;
    }
    if (!fecha) {
      setAddError("Selecciona una fecha.");
      return;
    }

    // En modo participaciones: el usuario mete participaciones + importe total,
    // derivamos el precio por unidad. En modo "solo dinero": participaciones =
    // importe (euros) y precio por unidad = 1.
    let part: number;
    let precioUnitario: number;
    if (conParticipaciones) {
      part = Number(participaciones);
      if (!Number.isFinite(part) || part <= 0) {
        setAddError("Participaciones debe ser mayor que 0.");
        return;
      }
      precioUnitario = tot / part;
    } else {
      part = tot;
      precioUnitario = 1;
    }

    await add({
      investmentId: investment.id,
      fecha: normalizeDateToUTCNoon(parseDateOnlyString(fecha)),
      participaciones: part,
      precioUnitario,
      cuentaOrigenId,
    });
    resetAddForm();
  }

  async function submitWithdraw() {
    if (!investment) return;
    if (!wDestino) {
      setWError("Selecciona la cuenta destino.");
      return;
    }
    const n = Number(wCantidad);
    if (!wTodo && (!Number.isFinite(n) || n <= 0)) {
      setWError(
        conParticipaciones
          ? "Participaciones a retirar mayor que 0."
          : "Importe a retirar mayor que 0.",
      );
      return;
    }
    await withdraw({
      investmentId: investment.id,
      cuentaDestinoId: wDestino,
      fecha: new Date(),
      todo: wTodo,
      ...(conParticipaciones ? { participaciones: n } : { importe: n }),
    });
    setWithdrawOpen(false);
    setWCantidad("");
    setWTodo(false);
    setWDestino("");
    setWError(null);
  }

  function openDelete(c: InvestmentContribution) {
    setToDelete(c);
    setRefundAccountId(c.cuentaOrigenId ?? "");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await remove({
      id: toDelete.id,
      refundAccountId: toDelete.movimientoId ? refundAccountId || null : null,
    });
    setToDelete(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aportaciones · {investment.nombre}</DialogTitle>
          <DialogDescription>
            Cada aportacion descuenta su importe de la cuenta de origen.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de aportaciones */}
        {contributions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aun no hay aportaciones.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                {conParticipaciones && (
                  <>
                    <TableHead className="text-right">Particip.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                  </>
                )}
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((c) => {
                const signo = c.esRetirada ? "−" : "";
                return (
                <TableRow key={c.id}>
                  <TableCell>
                    {formatDateLong(
                      c.fecha instanceof Date ? c.fecha : new Date(c.fecha),
                    )}
                    {c.esRetirada && (
                      <span className="ml-1 text-xs text-destructive">
                        retirada
                      </span>
                    )}
                  </TableCell>
                  {conParticipaciones && (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {signo}
                        {c.participaciones.toLocaleString("es-ES", {
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(c.precioUnitario, investment.moneda)}
                      </TableCell>
                    </>
                  )}
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      c.esRetirada && "text-destructive",
                    )}
                  >
                    {signo}
                    {formatAmount(
                      c.participaciones * c.precioUnitario,
                      investment.moneda,
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.cuentaOrigenId ? aliasById[c.cuentaOrigenId] ?? "—" : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDelete(c)}
                      disabled={isMutating}
                      aria-label="Borrar aportacion"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Formulario de añadir */}
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Anadir aportacion</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="ap-fecha" className="text-xs">Fecha</Label>
              <Input
                id="ap-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            {conParticipaciones && (
              <div className="space-y-1">
                <Label htmlFor="ap-part" className="text-xs">Participaciones</Label>
                <Input
                  id="ap-part"
                  type="number"
                  step="0.000001"
                  min={0}
                  value={participaciones}
                  onChange={(e) => setParticipaciones(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="ap-total" className="text-xs">Total aportado</Label>
              <Input
                id="ap-total"
                type="number"
                step="0.01"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ap-cuenta" className="text-xs">Cuenta de origen</Label>
              <Select value={cuentaOrigenId} onValueChange={setCuentaOrigenId}>
                <SelectTrigger id="ap-cuenta">
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {addError && (
            <p className="mt-2 text-xs text-destructive">{addError}</p>
          )}
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={submitAdd} disabled={isMutating}>
              <Plus className="mr-1 h-4 w-4" />
              Anadir
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setWError(null);
              setWithdrawOpen(true);
            }}
            disabled={isMutating}
          >
            <ArrowDownToLine className="mr-1 h-4 w-4" />
            Retirar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Retirada (reembolso) a una cuenta destino */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retirar de {investment.nombre}</DialogTitle>
            <DialogDescription>
              El dinero retirado entra en la cuenta destino. Baja el coste y el
              valor de la inversion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!wTodo && (
              <div className="space-y-1.5">
                <Label htmlFor="w-cantidad">
                  {conParticipaciones
                    ? "Participaciones a retirar"
                    : "Importe a retirar"}
                </Label>
                <Input
                  id="w-cantidad"
                  type="number"
                  step={conParticipaciones ? "0.000001" : "0.01"}
                  min={0}
                  value={wCantidad}
                  onChange={(e) => {
                    setWCantidad(e.target.value);
                    setWError(null);
                  }}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wTodo}
                onChange={(e) => {
                  setWTodo(e.target.checked);
                  setWError(null);
                }}
              />
              Retirar todo
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="w-destino">Cuenta destino</Label>
              <Select value={wDestino} onValueChange={setWDestino}>
                <SelectTrigger id="w-destino">
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {wError && <p className="text-sm text-destructive">{wError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawOpen(false)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button onClick={submitWithdraw} disabled={isMutating}>
              Retirar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmacion de borrado con devolucion */}
      <Dialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toDelete?.esRetirada ? "Borrar retirada" : "Borrar aportacion"}
            </DialogTitle>
            <DialogDescription>
              {toDelete && (
                <>
                  Se quitaran{" "}
                  {toDelete.participaciones.toLocaleString("es-ES", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  participaciones (
                  {formatAmount(
                    toDelete.participaciones * toDelete.precioUnitario,
                    investment.moneda,
                  )}
                  ).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {toDelete?.esRetirada ? (
            <p className="text-sm text-muted-foreground">
              Se deshara la retirada: el importe sale de la cuenta destino y
              vuelve a la inversion.
            </p>
          ) : toDelete?.movimientoId ? (
            <div className="space-y-1.5">
              <Label htmlFor="ap-refund">Devolver el importe a</Label>
              <Select value={refundAccountId} onValueChange={setRefundAccountId}>
                <SelectTrigger id="ap-refund">
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta aportacion no desconto de ninguna cuenta, asi que no se
              devuelve dinero.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={
                isMutating ||
                (!!toDelete?.movimientoId &&
                  !toDelete?.esRetirada &&
                  !refundAccountId)
              }
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
