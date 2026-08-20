"use client";

/**
 * ============================================================================
 *  src/app/deudas/page.tsx
 * ============================================================================
 *
 *  Vista mixta:
 *    - Tabla compacta arriba con todas las deudas
 *    - Card de detalle al hacer clic en una fila
 *    - KPIs globales: deuda total pendiente + cuota mensual total
 *
 *  Schema:
 *    OtherDebt = { concepto, tipo, importeInicial, capitalPendiente,
 *                   tin, plazoRestanteMeses, moneda, fechaInicio?, notas? }
 *
 *  La cuota se calcula sobre `importeInicial` con el plazo original
 *  aproximado: como solo guardamos plazoRestanteMeses, asumimos que la
 *  cuota se mantiene constante (que es lo habitual en un prestamo
 *  frances) y reusamos summarizeLoan(importeInicial, tin, plazoTotal).
 *  El plazo total no lo tenemos guardado; aproximamos suponiendo que el
 *  prestamo aun esta en su mitad: si quieres precision absoluta, podriamos
 *  anadir un campo `plazoTotalMeses` al schema mas adelante.
 *
 *  Por simplicidad, calculamos la cuota sobre (importeInicial, tin,
 *  plazoRestanteMeses + cuotasYaPagadasEstimadas) — pero como no las
 *  guardamos, usamos plazoRestanteMeses como plazo "vigente" para la
 *  cuota actual. Eso da una cuota razonable mientras no perdamos cuotas.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  AlertCircle,
  Banknote,
  CreditCard,
} from "lucide-react";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccounts } from "@/hooks/useAccounts";
import { OtherDebtFormDialog } from "@/components/forms/OtherDebtFormDialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { OtherDebt } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { summarizeLoan } from "@/lib/domain/mortgage";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export default function DeudasPage() {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { debts, isLoading, create, update, remove, isMutating } = useOtherDebts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OtherDebt | null>(null);
  const [toDelete, setToDelete] = useState<OtherDebt | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  /**
   * Calcula la cuota mensual de una deuda. Usa summarizeLoan sobre el
   * capital pendiente y el plazo restante (asi cuota = pago real para
   * acabar de saldar en ese plazo).
   */
  const computeCuota = (d: OtherDebt): number => {
    if (d.plazoRestanteMeses <= 0 || d.capitalPendiente <= 0) return 0;
    const { cuotaMensual } = summarizeLoan(
      d.capitalPendiente,
      d.tin,
      d.plazoRestanteMeses,
    );
    return cuotaMensual;
  };

  const totals = useMemo(() => {
    let pendienteVista = 0;
    let cuotaMensualVista = 0;
    for (const d of debts) {
      try {
        pendienteVista += convert(d.capitalPendiente, d.moneda, viewCurrency, rates);
        if (d.plazoRestanteMeses > 0) {
          cuotaMensualVista += convert(computeCuota(d), d.moneda, viewCurrency, rates);
        }
      } catch {
        // ignorar
      }
    }
    return { pendienteVista, cuotaMensualVista };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, rates, viewCurrency]);

  const selected = debts.find((d) => d.id === selectedId) ?? null;

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Otras deudas</h1>
          <p className="text-sm text-muted-foreground">
            Prestamos personales, coche, tarjetas con cuota. Para la
            hipoteca usa la seccion dedicada.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Anadir deuda
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deuda total pendiente
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-destructive">
              {money(totals.pendienteVista, viewCurrency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {debts.length} prestamos activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cuota mensual total
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {money(totals.cuotaMensualVista, viewCurrency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Suma de cuotas activas en {viewCurrency}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prestamos</CardTitle>
          <CardDescription>
            {debts.length === 0
              ? "Aun no hay deudas registradas."
              : "Haz clic en una fila para ver el detalle abajo."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && debts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pulsa "Anadir deuda" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">TIN</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                  <TableHead className="text-right">Progreso</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => {
                  const cuota = computeCuota(d);
                  // Progreso = (importeInicial - capitalPendiente) / importeInicial
                  const progreso =
                    d.importeInicial > 0
                      ? Math.max(
                          0,
                          Math.min(1, (d.importeInicial - d.capitalPendiente) / d.importeInicial),
                        )
                      : 0;
                  const isSelected = d.id === selectedId;
                  return (
                    <TableRow
                      key={d.id}
                      onClick={() => setSelectedId(isSelected ? null : d.id)}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40",
                        isSelected && "bg-muted/60",
                      )}
                    >
                      <TableCell className="font-medium">
                        {d.concepto}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{d.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive/80">
                        {money(d.capitalPendiente, d.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(d.tin * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(cuota, d.moneda)}
                      </TableCell>
                      <TableCell className="w-[140px]">
                        <div className="flex items-center gap-2">
                          <Progress value={progreso * 100} className="flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {(progreso * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(d);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(d)}
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

      {selected && <DebtDetailCard debt={selected} cuotaCalc={computeCuota(selected)} />}

      <OtherDebtFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        accounts={accounts}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          const payload = {
            concepto: data.concepto,
            tipo: data.tipo,
            importeInicial: data.importeInicial,
            capitalPendiente: data.capitalPendiente,
            tin: data.tin,
            plazoRestanteMeses: data.plazoRestanteMeses,
            moneda: data.moneda,
            cuentaPagoId: data.cuentaPagoId ?? null,
            fechaInicio: data.fechaInicio ?? null,
            notas: data.notas ?? null,
          };
          if (editing) {
            await update({ id: editing.id, patch: payload });
          } else {
            await create(payload);
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar deuda"
        description={
          toDelete
            ? `La deuda "${toDelete.concepto}" pasara a la papelera.`
            : ""
        }
        loading={isMutating}
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.id);
            if (selectedId === toDelete.id) setSelectedId(null);
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}

function DebtDetailCard({
  debt,
  cuotaCalc,
}: {
  debt: OtherDebt;
  cuotaCalc: number;
}) {
  const totalRestante = cuotaCalc * debt.plazoRestanteMeses;
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  const totalIntereses = Math.max(0, totalRestante - debt.capitalPendiente);
  const fechaInicio =
    debt.fechaInicio instanceof Date
      ? debt.fechaInicio
      : debt.fechaInicio
      ? new Date(debt.fechaInicio)
      : null;
  const progreso =
    debt.importeInicial > 0
      ? Math.max(
          0,
          Math.min(1, (debt.importeInicial - debt.capitalPendiente) / debt.importeInicial),
        )
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          {debt.concepto}
        </CardTitle>
        <CardDescription>
          {debt.tipo}
          {fechaInicio && ` · Inicio: ${formatDateLong(fechaInicio)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DetailKpi
            label="Cuota mensual"
            value={money(cuotaCalc, debt.moneda)}
          />
          <DetailKpi
            label="Importe inicial"
            value={money(debt.importeInicial, debt.moneda)}
          />
          <DetailKpi
            label="Capital pendiente"
            value={money(debt.capitalPendiente, debt.moneda)}
            intent="negative"
          />
          <DetailKpi
            label="Intereses restantes"
            value={money(totalIntereses, debt.moneda)}
            hint={`En ${debt.plazoRestanteMeses} cuotas`}
          />
        </div>

        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Progreso del prestamo</span>
            <span className="tabular-nums">{(progreso * 100).toFixed(0)}%</span>
          </div>
          <Progress value={progreso * 100} />
          <p className="text-xs text-muted-foreground tabular-nums">
            Quedan {debt.plazoRestanteMeses} cuotas ·{" "}
            {money(totalRestante, debt.moneda)} restante total
          </p>
        </div>

        {debt.notas && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {debt.notas}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailKpi({
  label,
  value,
  hint,
  intent = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  intent?: "neutral" | "negative";
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          intent === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
