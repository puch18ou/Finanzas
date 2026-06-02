"use client";

/**
 * ============================================================================
 *  src/components/forms/ContributionsDialog.tsx — Aportaciones de una inversion
 * ============================================================================
 *
 *  Dos pestañas:
 *    - Individuales: aportaciones puntuales (y retiradas). Botones "Anadir
 *      aportacion" y "Retirar".
 *    - Periodicas: lista de planes de aportacion periodica (se pueden tener
 *      varios) con su historial de aportaciones generadas.
 *
 *  Las listas tienen scroll propio para no desbordar el dialogo.
 * ============================================================================
 */

import { useState } from "react";
import { Plus, Trash2, ArrowDownToLine, Repeat, Pencil } from "lucide-react";
import type {
  Account,
  Investment,
  InvestmentContribution,
  RecurringRule,
} from "@/lib/db/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/domain/currency";
import {
  APORTACION_PERIODICA_NOTA,
  usaParticipaciones,
} from "@/lib/domain/investments";
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
  /** Se llama tras una retirada "todo" (la posicion queda a 0). */
  onWithdrewAll?: () => void;
};

// Dias de la semana en convencion JS getUTCDay (0=domingo). Orden de display
// empezando en lunes.
const DIAS_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
] as const;

const FRECUENCIA_LABEL: Record<string, string> = {
  diaria: "cada dia",
  semanal: "cada semana",
  mensual: "al mes",
};

export function ContributionsDialog({
  open,
  onOpenChange,
  investment,
  accounts,
  onWithdrewAll,
}: Props) {
  const {
    contributions,
    add,
    update,
    withdraw,
    remove,
    plans,
    savePlan,
    cancelPlan,
    isMutating,
  } = useInvestmentContributions(investment?.id);
  const activeAccounts = accounts.filter((a) => a.activa);
  const aliasById = Object.fromEntries(accounts.map((a) => [a.id, a.alias]));

  const [tab, setTab] = useState<"individuales" | "periodicas">("individuales");

  // Añadir / editar aportación
  const [addOpen, setAddOpen] = useState(false);
  // Lote 18: si != null, el dialog "Añadir" actua como "Editar" sobre esta fila.
  const [editingContribution, setEditingContribution] =
    useState<InvestmentContribution | null>(null);
  const [fecha, setFecha] = useState(formatDateOnlyString(new Date()));
  const [participaciones, setParticipaciones] = useState("");
  // En modo participaciones se mete PRECIO por unidad; en modo dinero el total.
  const [precioUnit, setPrecioUnit] = useState("");
  const [total, setTotal] = useState("");
  // Comision de la operacion (Lote 17). Solo aplica en modo participaciones.
  const [comision, setComision] = useState("");
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

  // Plan de aportación periódica
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [pImporte, setPImporte] = useState("");
  const [pCuenta, setPCuenta] = useState("");
  const [pFrecuencia, setPFrecuencia] = useState<
    "diaria" | "semanal" | "mensual"
  >("mensual");
  const [pDia, setPDia] = useState("1");
  const [pDiaSemana, setPDiaSemana] = useState("1");
  const [pInicio, setPInicio] = useState(formatDateOnlyString(new Date()));
  const [pFin, setPFin] = useState("");
  const [pError, setPError] = useState<string | null>(null);

  if (!investment) return null;

  // Modo participaciones (Acciones/ETF/Cripto) vs "solo dinero" (resto).
  const conParticipaciones = usaParticipaciones(investment.tipo);

  // Aportaciones periodicas (generadas por un plan) vs individuales (resto,
  // incluidas las retiradas).
  const esPeriodica = (c: InvestmentContribution) =>
    !c.esRetirada && c.notas === APORTACION_PERIODICA_NOTA;
  const periodicas = contributions.filter(esPeriodica);
  const individuales = contributions.filter((c) => !esPeriodica(c));

  function resetAddForm() {
    setFecha(formatDateOnlyString(new Date()));
    setParticipaciones("");
    setPrecioUnit("");
    setTotal("");
    setComision("");
    setCuentaOrigenId("");
    setAddError(null);
    setEditingContribution(null);
  }

  function openEditForm(c: InvestmentContribution) {
    setEditingContribution(c);
    const d = c.fecha instanceof Date ? c.fecha : new Date(c.fecha);
    setFecha(formatDateOnlyString(d));
    setCuentaOrigenId(c.cuentaOrigenId ?? "");
    setComision((c.comision ?? 0) > 0 ? String(c.comision) : "");
    if (conParticipaciones) {
      setParticipaciones(String(c.participaciones));
      setPrecioUnit(String(c.precioUnitario));
      setTotal("");
    } else {
      // Modo dinero: el "total aportado" = part*precio = participaciones (precio=1).
      setTotal(String(c.participaciones * c.precioUnitario));
      setParticipaciones("");
      setPrecioUnit("");
    }
    setAddError(null);
    setAddOpen(true);
  }

  async function submitAdd() {
    if (!investment) return;
    if (!cuentaOrigenId) {
      setAddError("Selecciona la cuenta.");
      return;
    }
    if (!fecha) {
      setAddError("Selecciona una fecha.");
      return;
    }

    let part: number;
    let precioUnitario: number;
    let fee = 0;
    if (conParticipaciones) {
      part = Number(participaciones);
      const pu = Number(precioUnit);
      if (!Number.isFinite(part) || part <= 0) {
        setAddError("Participaciones debe ser mayor que 0.");
        return;
      }
      if (!Number.isFinite(pu) || pu <= 0) {
        setAddError("Precio por unidad debe ser mayor que 0.");
        return;
      }
      precioUnitario = pu;
      const com = Number(comision);
      fee = Number.isFinite(com) && com >= 0 ? com : 0;
    } else {
      const tot = Number(total);
      if (!Number.isFinite(tot) || tot <= 0) {
        setAddError("El importe debe ser mayor que 0.");
        return;
      }
      part = tot;
      precioUnitario = 1;
    }

    const fechaNorm = normalizeDateToUTCNoon(parseDateOnlyString(fecha));

    if (editingContribution) {
      await update({
        id: editingContribution.id,
        fecha: fechaNorm,
        participaciones: part,
        precioUnitario,
        comision: fee,
        cuentaId: cuentaOrigenId,
        notas: editingContribution.notas,
      });
    } else {
      await add({
        investmentId: investment.id,
        fecha: fechaNorm,
        participaciones: part,
        precioUnitario,
        comision: fee,
        cuentaOrigenId,
      });
    }
    resetAddForm();
    setAddOpen(false);
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
    const fueTodo = wTodo;
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
    // Si se retiro todo, la posicion queda a 0: avisamos para ofrecer archivar.
    if (fueTodo) onWithdrewAll?.();
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

  function openPlanForm(p: RecurringRule | null) {
    if (p) {
      setEditingPlanId(p.id);
      setPImporte(String(p.importe));
      setPCuenta(p.cuentaOrigenId ?? "");
      setPFrecuencia(p.frecuencia);
      setPDia(String(p.diaDelMes));
      setPDiaSemana(String(p.diaSemana ?? 1));
      setPInicio(
        formatDateOnlyString(
          p.fechaInicio instanceof Date ? p.fechaInicio : new Date(p.fechaInicio),
        ),
      );
      setPFin(
        p.fechaFin
          ? formatDateOnlyString(
              p.fechaFin instanceof Date ? p.fechaFin : new Date(p.fechaFin),
            )
          : "",
      );
    } else {
      setEditingPlanId(null);
      setPImporte("");
      setPCuenta("");
      setPFrecuencia("mensual");
      setPDia("1");
      setPDiaSemana("1");
      setPInicio(formatDateOnlyString(new Date()));
      setPFin("");
    }
    setPError(null);
    setPlanFormOpen(true);
  }

  async function submitPlan() {
    if (!investment) return;
    const imp = Number(pImporte);
    if (!Number.isFinite(imp) || imp <= 0) {
      setPError("El importe debe ser mayor que 0.");
      return;
    }
    if (!pCuenta) {
      setPError("Selecciona la cuenta de origen.");
      return;
    }
    if (!pInicio) {
      setPError("Selecciona la fecha de inicio.");
      return;
    }
    const inicio = normalizeDateToUTCNoon(parseDateOnlyString(pInicio));

    // diaDelMes solo aplica a 'mensual'; en otras frecuencias guardamos el dia
    // de la fecha de inicio para satisfacer la columna NOT NULL (1-31).
    let diaDelMes = inicio.getUTCDate();
    if (pFrecuencia === "mensual") {
      const dia = Number(pDia);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        setPError("El dia del mes debe estar entre 1 y 31.");
        return;
      }
      diaDelMes = dia;
    }

    await savePlan({
      id: editingPlanId ?? undefined,
      nombre: investment.nombre,
      moneda: investment.moneda,
      importe: imp,
      cuentaOrigenId: pCuenta,
      frecuencia: pFrecuencia,
      diaDelMes,
      diaSemana: pFrecuencia === "semanal" ? Number(pDiaSemana) : null,
      fechaInicio: inicio,
      fechaFin: pFin ? normalizeDateToUTCNoon(parseDateOnlyString(pFin)) : null,
    });
    setPlanFormOpen(false);
  }

  function planResumen(p: RecurringRule): string {
    const detalle =
      p.frecuencia === "mensual"
        ? `, dia ${p.diaDelMes}`
        : p.frecuencia === "semanal"
          ? `, ${DIAS_SEMANA.find((d) => d.value === p.diaSemana)?.label ?? ""}`
          : "";
    const fin = p.fechaFin
      ? ` · hasta ${formatDateLong(
          p.fechaFin instanceof Date ? p.fechaFin : new Date(p.fechaFin),
          false,
        )}`
      : "";
    return `${formatAmount(p.importe, investment!.moneda)} ${
      FRECUENCIA_LABEL[p.frecuencia] ?? "al mes"
    } desde ${aliasById[p.cuentaOrigenId ?? ""] ?? "—"}${detalle}${fin}`;
  }

  function renderContribList(
    list: InvestmentContribution[],
    emptyText: string,
  ) {
    if (list.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      );
    }
    return (
      <div className="max-h-[38vh] overflow-y-auto rounded-md border">
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
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => {
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
                        {formatAmount(c.precioUnitario, investment!.moneda)}
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
                      c.esRetirada
                        ? Math.max(
                            0,
                            c.participaciones * c.precioUnitario -
                              (c.comision ?? 0),
                          )
                        : c.participaciones * c.precioUnitario +
                          (c.comision ?? 0),
                      investment!.moneda,
                    )}
                    {(c.comision ?? 0) > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {c.esRetirada ? "− " : "+ "}
                        {formatAmount(c.comision ?? 0, investment!.moneda)} fee
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.cuentaOrigenId ? aliasById[c.cuentaOrigenId] ?? "—" : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(c)}
                        disabled={isMutating}
                        aria-label="Editar aportacion"
                        className="h-7 w-7"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => openDelete(c)}
                        disabled={isMutating}
                        aria-label="Borrar aportacion"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
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

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "individuales" | "periodicas")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individuales">
              Individuales
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {individuales.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="periodicas">
              Periodicas
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {plans.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Individuales */}
          <TabsContent value="individuales" className="space-y-3">
            {renderContribList(individuales, "Aun no hay aportaciones.")}
            <div className="flex justify-between gap-2">
              <Button
                size="sm"
                onClick={() => {
                  resetAddForm();
                  setAddOpen(true);
                }}
                disabled={isMutating}
              >
                <Plus className="mr-1 h-4 w-4" />
                Anadir aportacion
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setWError(null);
                  setWithdrawOpen(true);
                }}
                disabled={isMutating}
              >
                <ArrowDownToLine className="mr-1 h-4 w-4" />
                Retirar
              </Button>
            </div>
          </TabsContent>

          {/* Periodicas */}
          <TabsContent value="periodicas" className="space-y-3">
            <div className="space-y-2">
              {plans.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No tienes aportaciones periodicas. Crea una para aportar
                  automaticamente cada dia, semana o mes.
                </p>
              ) : (
                plans.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                  >
                    <p className="flex items-center gap-1.5 text-sm">
                      <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {planResumen(p)}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openPlanForm(p)}
                        disabled={isMutating}
                        aria-label="Editar plan"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => cancelPlan(p.id)}
                        disabled={isMutating}
                        aria-label="Cancelar plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPlanForm(null)}
                disabled={isMutating}
              >
                <Plus className="mr-1 h-4 w-4" />
                Nueva periodica
              </Button>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Aportaciones generadas
              </p>
              {renderContribList(
                periodicas,
                "Aun no se ha generado ninguna aportacion periodica.",
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Añadir aportación */}
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) resetAddForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContribution
                ? editingContribution.esRetirada
                  ? "Editar retirada"
                  : "Editar aportacion"
                : "Anadir aportacion"}{" "}
              · {investment.nombre}
            </DialogTitle>
            <DialogDescription>
              {editingContribution
                ? "Se actualiza tambien el movimiento asociado en la cuenta."
                : "Descuenta el importe de la cuenta de origen."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ap-fecha" className="text-xs">
                Fecha
              </Label>
              <Input
                id="ap-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            {conParticipaciones ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="ap-part" className="text-xs">
                    Participaciones
                  </Label>
                  <Input
                    id="ap-part"
                    type="number"
                    step="0.000001"
                    min={0}
                    value={participaciones}
                    onChange={(e) => setParticipaciones(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ap-precio" className="text-xs">
                    Precio por unidad
                  </Label>
                  <Input
                    id="ap-precio"
                    type="number"
                    step="0.000001"
                    min={0}
                    value={precioUnit}
                    onChange={(e) => setPrecioUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ap-fee" className="text-xs">
                    Comision (opcional)
                  </Label>
                  <Input
                    id="ap-fee"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0"
                    value={comision}
                    onChange={(e) => setComision(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="ap-total" className="text-xs">
                  Total aportado
                </Label>
                <Input
                  id="ap-total"
                  type="number"
                  step="0.01"
                  min={0}
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1 col-span-2">
              <Label htmlFor="ap-cuenta" className="text-xs">
                {editingContribution?.esRetirada
                  ? "Cuenta destino"
                  : "Cuenta de origen"}
              </Label>
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
          {conParticipaciones && participaciones && precioUnit && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              Total a descontar:{" "}
              {formatAmount(
                Number(participaciones) * Number(precioUnit) +
                  (Number(comision) || 0),
                investment!.moneda,
              )}
            </p>
          )}
          {addError && <p className="mt-2 text-xs text-destructive">{addError}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button onClick={submitAdd} disabled={isMutating}>
              {editingContribution ? (
                "Guardar"
              ) : (
                <>
                  <Plus className="mr-1 h-4 w-4" />
                  Anadir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Formulario de plan periódico */}
      <Dialog open={planFormOpen} onOpenChange={setPlanFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlanId ? "Editar" : "Nueva"} aportacion periodica
            </DialogTitle>
            <DialogDescription>
              Registra una aportacion automatica cada dia, semana o mes desde una
              cuenta. Se genera al abrir la app.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pl-importe" className="text-xs">
                Importe
              </Label>
              <Input
                id="pl-importe"
                type="number"
                step="0.01"
                min={0}
                value={pImporte}
                onChange={(e) => setPImporte(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pl-cuenta" className="text-xs">
                Cuenta de origen
              </Label>
              <Select value={pCuenta} onValueChange={setPCuenta}>
                <SelectTrigger id="pl-cuenta">
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
            <div className="space-y-1">
              <Label htmlFor="pl-frec" className="text-xs">
                Frecuencia
              </Label>
              <Select
                value={pFrecuencia}
                onValueChange={(v) =>
                  setPFrecuencia(v as "diaria" | "semanal" | "mensual")
                }
              >
                <SelectTrigger id="pl-frec">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="diaria">Diaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pFrecuencia === "mensual" && (
              <div className="space-y-1">
                <Label htmlFor="pl-dia" className="text-xs">
                  Dia del mes
                </Label>
                <Input
                  id="pl-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={pDia}
                  onChange={(e) => setPDia(e.target.value)}
                />
              </div>
            )}
            {pFrecuencia === "semanal" && (
              <div className="space-y-1">
                <Label htmlFor="pl-diasem" className="text-xs">
                  Dia de la semana
                </Label>
                <Select value={pDiaSemana} onValueChange={setPDiaSemana}>
                  <SelectTrigger id="pl-diasem">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="pl-inicio" className="text-xs">
                Desde
              </Label>
              <Input
                id="pl-inicio"
                type="date"
                value={pInicio}
                onChange={(e) => setPInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pl-fin" className="text-xs">
                Hasta (opcional)
              </Label>
              <Input
                id="pl-fin"
                type="date"
                value={pFin}
                onChange={(e) => setPFin(e.target.value)}
              />
            </div>
          </div>
          {conParticipaciones && (
            <p className="mt-2 text-xs text-muted-foreground">
              Las participaciones se calculan con el valor actual de cada periodo
              al generarse.
            </p>
          )}
          {pError && <p className="mt-2 text-xs text-destructive">{pError}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanFormOpen(false)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button onClick={submitPlan} disabled={isMutating}>
              Guardar plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmacion de borrado con devolucion */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
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
