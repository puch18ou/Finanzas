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

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Layers,
  RefreshCw,
  Archive,
  ArchiveRestore,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Banknote,
} from "lucide-react";
import { useInvestments } from "@/hooks/useInvestments";
import { useInvestmentContributions } from "@/hooks/useInvestmentContributions";
import { useAccounts } from "@/hooks/useAccounts";
import { useRepos } from "@/contexts/DatabaseProvider";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { InvestmentFormDialog } from "@/components/forms/InvestmentFormDialog";
import { ContributionsDialog } from "@/components/forms/ContributionsDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TIPOS_INVERSION } from "@/lib/schemas/forms";
import type { Investment } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import {
  calculateInvestmentMetrics,
  summarizePortfolio,
  usaParticipaciones,
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
    archive,
    unarchive,
    isMutating,
  } = useInvestments();
  const { add: addContribution } = useInvestmentContributions();
  const repos = useRepos();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [toDelete, setToDelete] = useState<Investment | null>(null);
  const [toArchive, setToArchive] = useState<Investment | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contributionsFor, setContributionsFor] = useState<Investment | null>(
    null,
  );

  const { data: archivadas = [] } = useQuery({
    queryKey: ["investmentsArchived"],
    queryFn: () => repos.investments.listArchived(),
    enabled: showArchived,
  });

  // Dialogo "Actualizar valor actual" (valor TOTAL real de hoy).
  const [valueFor, setValueFor] = useState<Investment | null>(null);
  const [valueInput, setValueInput] = useState("");

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

  const openValueUpdate = (inv: Investment) => {
    setValueFor(inv);
    setValueInput(String(inv.precioActual * inv.participaciones));
  };

  const submitValueUpdate = async () => {
    if (!valueFor) return;
    const valorTotal = Number(valueInput);
    if (isNaN(valorTotal) || valorTotal < 0) return;
    // El usuario indica el VALOR TOTAL real; derivamos el precio por unidad.
    const nuevoPrecio =
      valueFor.participaciones > 0 ? valorTotal / valueFor.participaciones : 0;
    await updatePrice({ id: valueFor.id, precio: nuevoPrecio });
    setValueFor(null);
  };

  // Tipos que tienen al menos una inversion, en el orden del catalogo.
  const tiposPresentes = TIPOS_INVERSION.filter((t) =>
    investments.some((inv) => inv.tipo === t),
  );

  // Tabla de posiciones reutilizable. `showParticipaciones` controla si se
  // muestran las columnas de participaciones y precio/ud (se ocultan en las
  // pestanas de tipos "solo dinero").
  const renderTable = (
    list: Investment[],
    showParticipaciones: boolean,
    archived = false,
  ) => {
    if (!isLoading && list.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay inversiones en esta vista.
        </p>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            {showParticipaciones && (
              <TableHead className="text-right">Participaciones</TableHead>
            )}
            <TableHead className="text-right">Coste</TableHead>
            <TableHead className="text-right">Valor actual</TableHead>
            <TableHead className="text-right">P/L</TableHead>
            <TableHead className="text-right">En {viewCurrency}</TableHead>
            <TableHead className="w-[80px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((inv) => {
            const m = calculateInvestmentMetrics(inv);
            let valorEnVista: number | null = null;
            try {
              valorEnVista = convert(m.valorActual, inv.moneda, viewCurrency, rates);
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
                {showParticipaciones && (
                  <TableCell className="text-right tabular-nums">
                    {usaParticipaciones(inv.tipo)
                      ? inv.participaciones.toLocaleString("es-ES", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 6,
                        })
                      : "—"}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">
                  <div className="font-medium">
                    {formatAmount(m.costeTotal, inv.moneda)}
                  </div>
                  {usaParticipaciones(inv.tipo) && (
                    <div className="text-xs text-muted-foreground">
                      {formatAmount(inv.precioCompra, inv.moneda)}/ud
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatAmount(m.valorActual, inv.moneda)}
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
                  {inv.moneda === viewCurrency ? (
                    "—"
                  ) : valorEnVista !== null ? (
                    formatAmount(valorEnVista, viewCurrency)
                  ) : (
                    <span className="text-destructive">err</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {archived ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unarchive(inv.id)}
                          aria-label="Desarchivar"
                        >
                          <ArchiveRestore className="h-4 w-4" />
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
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openValueUpdate(inv)}
                          aria-label="Actualizar valor"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
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
                          onClick={() => setToArchive(inv)}
                          disabled={m.valorActual >= 0.005}
                          aria-label="Archivar"
                          title={
                            m.valorActual >= 0.005
                              ? "Solo se puede archivar con valor 0"
                              : "Archivar"
                          }
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inversiones</h1>
          <p className="text-sm text-muted-foreground">
            Cartera de acciones, ETFs, fondos y cripto. Usa el boton de
            actualizar para poner el valor actual de cada posicion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label
            htmlFor="show-archived"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            Mostrar archivadas
          </Label>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Anadir inversion
          </Button>
        </div>
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

      <Tabs defaultValue="resumen">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          {tiposPresentes.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <CardTitle>Todas las posiciones</CardTitle>
              <CardDescription>
                {investments.length} posiciones en cartera.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderTable(investments, true)}</CardContent>
          </Card>
        </TabsContent>

        {tiposPresentes.map((t) => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardHeader>
                <CardTitle>{t}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTable(
                  investments.filter((inv) => inv.tipo === t),
                  usaParticipaciones(t),
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {showArchived && (
        <Card>
          <CardHeader>
            <CardTitle>Archivadas</CardTitle>
            <CardDescription>
              Posiciones cerradas (valor 0). Fuera de los KPIs y la vista
              principal. Puedes desarchivarlas cuando quieras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archivadas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes inversiones archivadas.
              </p>
            ) : (
              renderTable(archivadas, true, true)
            )}
          </CardContent>
        </Card>
      )}

      <InvestmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        accounts={accounts}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onDelete={
          editing
            ? () => {
                const inv = editing;
                setFormOpen(false);
                setToDelete(inv);
              }
            : undefined
        }
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
            // Modo participaciones (Acciones/ETF/Cripto): el usuario mete
            // participaciones + importe total -> precio por unidad derivado.
            // Modo "solo dinero" (resto): no hay participaciones; usamos el
            // importe como "unidades" a precio 1 (asi coste y valor cuadran).
            const conPart = usaParticipaciones(data.tipo);
            const part = conPart ? data.participaciones : data.importeInvertido;
            const precioUnitario = conPart
              ? data.participaciones > 0
                ? data.importeInvertido / data.participaciones
                : 0
              : 1;
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
              participaciones: part,
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
        onWithdrewAll={() => {
          const inv = contributionsFor;
          setContributionsFor(null);
          if (inv) setToArchive(inv);
        }}
      />

      <Dialog open={!!valueFor} onOpenChange={(v) => !v && setValueFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar valor actual</DialogTitle>
            <DialogDescription>
              {valueFor?.nombre}: indica cuanto vale HOY en total (no por
              unidad). No mueve dinero; solo actualiza el valor de mercado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="valor-actual-input">
              Valor actual ({valueFor?.moneda})
            </Label>
            <Input
              id="valor-actual-input"
              type="number"
              step="0.01"
              min={0}
              value={valueInput}
              autoFocus
              onChange={(e) => setValueInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValueFor(null)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button onClick={submitValueUpdate} disabled={isMutating}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Confirmar archivar */}
      <Dialog open={!!toArchive} onOpenChange={(v) => !v && setToArchive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archivar inversion</DialogTitle>
            <DialogDescription>
              {toArchive
                ? `"${toArchive.nombre}" se archivara como posicion cerrada. Se cancelaran sus aportaciones periodicas y quedara fuera de la vista principal. Podras desarchivarla cuando quieras.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setToArchive(null)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (toArchive) {
                  await archive(toArchive.id);
                  setToArchive(null);
                }
              }}
              disabled={isMutating}
            >
              <Archive className="mr-1 h-4 w-4" />
              Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
