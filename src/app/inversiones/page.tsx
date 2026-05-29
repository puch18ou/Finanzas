"use client";

/**
 * ============================================================================
 *  src/app/inversiones/page.tsx
 * ============================================================================
 *
 *  CRUD de inversiones con tabla rica. KPIs arriba, tabla principal abajo.
 *  El "broker" se modela como cuenta de tipo Broker vinculada a la inversion.
 * ============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Layers,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Banknote,
} from "lucide-react";
import { useInvestments } from "@/hooks/useInvestments";
import { useInvestmentContributions } from "@/hooks/useInvestmentContributions";
import { useAccounts } from "@/hooks/useAccounts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { InvestmentFormDialog } from "@/components/forms/InvestmentFormDialog";
import { ContributionsDialog } from "@/components/forms/ContributionsDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Investment } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import {
  calculateInvestmentMetrics,
  summarizePortfolio,
} from "@/lib/domain/investments";
import { cn } from "@/lib/utils/cn";

export default function InversionesPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const {
    investments,
    isLoading,
    create,
    update,
    updatePrice,
    remove,
    isMutating,
  } = useInvestments();
  const { add: addContribution } = useInvestmentContributions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [toDelete, setToDelete] = useState<Investment | null>(null);
  const [contributionsFor, setContributionsFor] = useState<Investment | null>(
    null,
  );

  // Valor actual TOTAL en edicion local (mientras el usuario escribe). El
  // usuario edita el total; el precio por unidad se deriva al guardar.
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const inv of investments) {
      m[inv.id] = String(inv.precioActual * inv.participaciones);
    }
    setPriceEdits(m);
  }, [investments]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const portfolio = useMemo(
    () => summarizePortfolio(investments, rates, viewCurrency),
    [investments, rates, viewCurrency],
  );

  // Lookup rapido: id de cuenta → alias (para mostrar el broker en la tabla)
  const accountAliasById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.alias;
    return m;
  }, [accounts]);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const handlePriceBlur = async (inv: Investment) => {
    const raw = priceEdits[inv.id];
    if (raw === undefined) return;
    const valorTotal = Number(raw);
    if (isNaN(valorTotal) || valorTotal < 0) return;
    if (valorTotal === inv.precioActual * inv.participaciones) return;
    // El usuario edita el VALOR TOTAL; derivamos el precio por unidad.
    const nuevoPrecio =
      inv.participaciones > 0 ? valorTotal / inv.participaciones : 0;
    await updatePrice({ id: inv.id, precio: nuevoPrecio });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inversiones</h1>
          <p className="text-sm text-muted-foreground">
            Cartera de acciones, ETFs, fondos y cripto. Edita el precio
            actual directamente en la tabla.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Anadir inversion
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiPortfolio
          icon={Banknote}
          label="Valor cartera"
          value={formatAmount(portfolio.valorActualVista, viewCurrency)}
          hint={`${portfolio.numPosiciones} posiciones`}
        />
        <KpiPortfolio
          icon={PieIcon}
          label="Coste total invertido"
          value={formatAmount(portfolio.costeTotalVista, viewCurrency)}
        />
        <KpiPortfolio
          icon={portfolio.plAbsolutoVista >= 0 ? TrendingUp : TrendingDown}
          label="Plusvalia"
          value={`${portfolio.plAbsolutoVista >= 0 ? "+" : ""}${formatAmount(
            portfolio.plAbsolutoVista,
            viewCurrency,
          )}`}
          intent={portfolio.plAbsolutoVista >= 0 ? "positive" : "negative"}
          hint={`${(portfolio.plPorcentaje * 100).toFixed(2)}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posiciones</CardTitle>
          <CardDescription>
            {investments.length} posiciones en cartera. Edita el precio
            actual haciendo clic en la celda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && investments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aun no hay inversiones. Pulsa "Anadir inversion" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Participaciones</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead className="text-right">Valor actual</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="text-right">En {viewCurrency}</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map((inv) => {
                  const m = calculateInvestmentMetrics(inv);
                  let valorEnVista: number | null = null;
                  try {
                    valorEnVista = convert(
                      m.valorActual,
                      inv.moneda,
                      viewCurrency,
                      rates,
                    );
                  } catch {
                    valorEnVista = null;
                  }
                  const plPositive = m.plAbsoluto >= 0;
                  const brokerAlias = inv.cuentaId
                    ? accountAliasById[inv.cuentaId]
                    : null;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Badge variant="secondary">{inv.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{inv.nombre}</div>
                        {(inv.ticker || brokerAlias) && (
                          <div className="text-xs font-mono text-muted-foreground">
                            {inv.ticker}
                            {inv.ticker && brokerAlias && " · "}
                            {brokerAlias}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inv.participaciones.toLocaleString("es-ES", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-medium">
                          {formatAmount(m.costeTotal, inv.moneda)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAmount(inv.precioCompra, inv.moneda)}/ud
                        </div>
                      </TableCell>
                      <TableCell className="text-right p-1">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={priceEdits[inv.id] ?? ""}
                          onChange={(e) =>
                            setPriceEdits((prev) => ({
                              ...prev,
                              [inv.id]: e.target.value,
                            }))
                          }
                          onBlur={() => handlePriceBlur(inv)}
                          disabled={isMutating}
                          className="h-8 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          plPositive ? "text-primary" : "text-destructive",
                        )}
                      >
                        <div>
                          {plPositive ? "+" : ""}
                          {formatAmount(m.plAbsoluto, inv.moneda)}
                        </div>
                        <div className="text-xs">
                          {plPositive ? "+" : ""}
                          {(m.plPorcentaje * 100).toFixed(2)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {inv.moneda === viewCurrency
                          ? "—"
                          : valorEnVista !== null
                          ? formatAmount(valorEnVista, viewCurrency)
                          : <span className="text-destructive">err</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setContributionsFor(inv)}
                            aria-label="Aportaciones"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(inv);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(inv)}
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

      <InvestmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        accounts={accounts}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            // Al editar solo se tocan los metadatos + el valor actual TOTAL
            // (de el derivamos el precio por unidad). Participaciones, coste,
            // fecha y cuenta salen de las aportaciones, no se editan aqui.
            const precioActual =
              editing.participaciones > 0
                ? data.valorActual / editing.participaciones
                : 0;
            await update({
              id: editing.id,
              patch: {
                tipo: data.tipo,
                ticker: data.ticker ?? null,
                nombre: data.nombre,
                moneda: data.moneda,
                precioActual,
                notas: data.notas ?? null,
              },
            });
          } else {
            // El usuario introduce el IMPORTE TOTAL invertido; derivamos el
            // precio por unidad.
            const precioUnitario =
              data.participaciones > 0
                ? data.importeInvertido / data.participaciones
                : 0;
            // Creamos la inversion "vacia" (0); la aportacion inicial fija
            // participaciones, coste y valor actual (asi el valor actual sube
            // exactamente por el importe invertido, sin duplicar).
            const inv = await create({
              tipo: data.tipo,
              ticker: data.ticker ?? null,
              nombre: data.nombre,
              participaciones: 0,
              precioCompra: 0,
              precioActual: 0,
              moneda: data.moneda,
              cuentaId: data.cuentaId ?? null,
              fechaCompra: data.fechaCompra ?? null,
              notas: data.notas ?? null,
            });
            // La primera compra es una aportacion: descuenta de la cuenta de
            // origen (movimiento de salida) y deja el historial para el grafico.
            await addContribution({
              investmentId: inv.id,
              fecha: data.fechaCompra ?? new Date(),
              participaciones: data.participaciones,
              precioUnitario,
              cuentaOrigenId: data.cuentaId ?? null,
            });
          }
        }}
      />

      <ContributionsDialog
        open={!!contributionsFor}
        onOpenChange={(v) => !v && setContributionsFor(null)}
        investment={contributionsFor}
        accounts={accounts}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar inversion"
        description={
          toDelete
            ? `La inversion "${toDelete.nombre}" pasara a la papelera.`
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

function KpiPortfolio({
  icon: Icon,
  label,
  value,
  hint,
  intent = "neutral",
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  intent?: "neutral" | "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold tabular-nums",
            intent === "positive" && "text-primary",
            intent === "negative" && "text-destructive",
          )}
        >
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
