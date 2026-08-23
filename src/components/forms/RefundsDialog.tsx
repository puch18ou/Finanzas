"use client";

/**
 * src/components/forms/RefundsDialog.tsx — Devoluciones de un gasto.
 *
 * Muestra y gestiona las devoluciones asociadas a un GASTO concreto (mismo
 * patron que las aportaciones de una inversion). Cada devolucion es un
 * movimiento tipo 'devolucion' con gastoAsociadoId = id del gasto, que HEREDA
 * la categoria del gasto (para que reste de su categoria). La MONEDA es la del
 * gasto por defecto pero se puede cambiar (te pueden devolver en otra divisa);
 * el coste real convierte cada devolucion a la moneda del gasto al cambio.
 */

import { useEffect, useMemo, useState } from "react";
import { Undo2, Trash2, Plus } from "lucide-react";
import { useRefunds } from "@/hooks/useRefunds";
import { costeReal, sumRefundsInCurrency } from "@/lib/domain/refunds";
import { formatAmount, buildRatesMap } from "@/lib/domain/currency";
import { formatDateLong } from "@/lib/utils/dates";
import type { Account, Currency, Movement } from "@/lib/db/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasto: Movement | null;
  accounts: Account[];
  accById: Record<string, string>;
  currencies: Currency[];
  defaultAccountId?: string | null;
  /** modal=false + sin cierre por click-fuera/Escape: lo usa el demo. */
  modal?: boolean;
};

export function RefundsDialog({
  open,
  onOpenChange,
  gasto,
  accounts,
  accById,
  currencies,
  defaultAccountId,
  modal = true,
}: Props) {
  const { refunds, add, remove, isMutating } = useRefunds(gasto?.id ?? null);

  const [importe, setImporte] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [fecha, setFecha] = useState(todayStr());
  // Una devolucion SIEMPRE entra en una cuenta: sin cuenta por defecto obligamos
  // a elegirla ("" = sin elegir).
  const [cuentaId, setCuentaId] = useState<string>(defaultAccountId ?? "");
  const [error, setError] = useState<string | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const cuentasActivas = accounts.filter((a) => a.activa);

  // Al abrir (o cambiar de gasto), la moneda por defecto es la del gasto.
  useEffect(() => {
    if (open && gasto) {
      setMoneda(gasto.moneda);
      setImporte("");
      setFecha(todayStr());
      setCuentaId(defaultAccountId ?? "");
      setError(null);
    }
  }, [open, gasto?.id, gasto?.moneda, defaultAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalDevuelto = gasto
    ? sumRefundsInCurrency(refunds, gasto.moneda, rates)
    : 0;
  const real = gasto ? costeReal(gasto.importe, totalDevuelto) : 0;

  const handleAdd = async () => {
    if (!gasto) return;
    const val = Number(importe);
    if (isNaN(val) || val <= 0) {
      setError("El importe debe ser mayor que 0.");
      return;
    }
    if (!cuentaId) {
      setError("Elige la cuenta donde entra el dinero.");
      return;
    }
    setError(null);
    const f = new Date(fecha + "T12:00:00Z");
    await add({
      tipo: "devolucion",
      fecha: f,
      mes: f.getUTCMonth() + 1,
      anio: f.getUTCFullYear(),
      concepto: `Devolución: ${gasto.concepto}`,
      importe: val,
      moneda, // por defecto la del gasto, pero puede ser otra
      cuentaOrigenId: null,
      cuentaDestinoId: cuentaId,
      categoriaId: gasto.categoriaId, // hereda -> resta de la categoria del gasto
      categoriaTexto: null,
      gastoAsociadoId: gasto.id,
      notas: null,
      esAutomatico: false,
      origenAutomatico: null,
      origenAutomaticoId: null,
    });
    setImporte("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent
        className="sm:max-w-lg"
        data-tour="refunds-dialog"
        onInteractOutside={(e) => {
          if (!modal) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!modal) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Devoluciones
          </DialogTitle>
          <DialogDescription>{gasto ? gasto.concepto : ""}</DialogDescription>
        </DialogHeader>

        {gasto && (
          <>
            {/* Resumen: importe, devuelto (en la moneda del gasto), coste real */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Gasto</p>
                <p className="font-medium tabular-nums">
                  {formatAmount(gasto.importe, gasto.moneda)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Devuelto</p>
                <p className="font-medium tabular-nums text-primary">
                  −{formatAmount(totalDevuelto, gasto.moneda)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coste real</p>
                <p className="font-semibold tabular-nums">
                  {formatAmount(real, gasto.moneda)}
                </p>
              </div>
            </div>

            {/* Lista de devoluciones existentes */}
            <div className="space-y-1">
              {refunds.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Aún no hay devoluciones para este gasto.
                </p>
              ) : (
                refunds.map((r) => {
                  const f = r.fecha instanceof Date ? r.fecha : new Date(r.fecha);
                  const cuenta = r.cuentaDestinoId
                    ? accById[r.cuentaDestinoId] ?? "?"
                    : "—";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="text-muted-foreground">
                        {formatDateLong(f)} · {cuenta}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-primary">
                          {formatAmount(r.importe, r.moneda)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => remove(r.id)}
                          disabled={isMutating}
                          aria-label="Quitar devolución"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Formulario para añadir una devolucion */}
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Añadir devolución</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-importe">Importe</Label>
                  <Input
                    id="r-importe"
                    type="number"
                    step="0.01"
                    min={0}
                    value={importe}
                    onChange={(e) => {
                      setImporte(e.target.value);
                      setError(null);
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select value={moneda} onValueChange={setMoneda}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-fecha">Fecha</Label>
                  <Input
                    id="r-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Entra en la cuenta</Label>
                <Select value={cuentaId} onValueChange={setCuentaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentasActivas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                type="button"
                onClick={handleAdd}
                disabled={isMutating}
                className="w-full gap-2"
                data-tour="refund-add"
              >
                <Plus className="h-4 w-4" />
                {isMutating ? "Guardando..." : "Añadir devolución"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
