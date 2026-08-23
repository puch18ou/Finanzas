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
  DownloadCloud,
} from "lucide-react";
import { toast } from "sonner";
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
import type { RatesMap } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { useCurrenciesManagement } from "@/hooks/useCurrenciesManagement";
import { cn } from "@/lib/utils/cn";
import { timeAgo, stalenessLevel } from "@/lib/utils/staleness";

export default function InversionesPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const {
    investments,
    isLoading,
    update,
    updatePrice,
    refreshQuote,
    isRefreshingQuote,
    remove,
    archive,
    unarchive,
    isMutating,
  } = useInvestments();
  const { add: addContribution, createWithContribution } =
    useInvestmentContributions();
  const { refreshRates } = useCurrenciesManagement();
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
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));

  // Tab activo en la seccion de pestañas por tipo. Los KPIs de arriba se
  // calculan sobre las inversiones de la pestaña activa (o todas en 'resumen').
  const [activeTab, setActiveTab] = useState<string>("resumen");

  const investmentsForKpi = useMemo(
    () =>
      activeTab === "resumen"
        ? investments
        : investments.filter((inv) => inv.tipo === activeTab),
    [investments, activeTab],
  );

  const portfolio = useMemo(
    () => summarizePortfolio(investmentsForKpi, rates, viewCurrency),
    [investmentsForKpi, rates, viewCurrency],
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
    // En modo participaciones mostramos el precio POR UNIDAD; en modo dinero
    // el VALOR TOTAL.
    const usaPart = usaParticipaciones(inv.tipo);
    setValueInput(
      String(usaPart ? inv.precioActual : inv.precioActual * inv.participaciones),
    );
  };

  const submitValueUpdate = async () => {
    if (!valueFor) return;
    const valorInput = Number(valueInput);
    if (isNaN(valorInput) || valorInput < 0) return;
    const usaPart = usaParticipaciones(valueFor.tipo);
    // Modo participaciones: el usuario indica precio por unidad directamente.
    // Modo dinero: indica el valor TOTAL; derivamos el precio por unidad.
    const nuevoPrecio = usaPart
      ? valorInput
      : valueFor.participaciones > 0
        ? valorInput / valueFor.participaciones
        : 0;
    await updatePrice({ id: valueFor.id, precio: nuevoPrecio });
    setValueFor(null);
  };

  // ¿Se puede cotizar por API? Salvo la cuenta remunerada (que se valora por
  // TAE, no por mercado): cualquier activo con ticker (Yahoo), o un fondo "por
  // dinero" con ISIN (su VL se baja de Financial Times; ver
  // useInvestments.refreshQuote). Los fondos se valoran escalando por el VL.
  const cotizable = (inv: Investment) =>
    inv.tipo !== "Cuenta remunerada" &&
    ((!!inv.ticker && inv.ticker.trim() !== "") ||
      (!usaParticipaciones(inv.tipo) && !!inv.isin && inv.isin.trim() !== ""));

  // Refresca los tipos de cambio (BCE) y devuelve el mapa YA actualizado. Asi
  // la conversion del precio (p.ej. oro USD->EUR) usa el tipo de HOY y no uno
  // viejo de la tabla (que descuadraba el valor). Si no hay red, usa los
  // tipos locales como respaldo.
  const getFreshRates = async (): Promise<RatesMap> => {
    try {
      const res = await refreshRates({ viewCurrency });
      return res?.ratesMap ?? rates;
    } catch {
      return rates;
    }
  };

  const handleRefreshQuote = async (inv: Investment) => {
    try {
      const useRates = await getFreshRates();
      const r = await refreshQuote({ inv, rates: useRates });
      const de = r.convertidoDe ? ` (de ${r.convertidoDe})` : "";
      if (r.modo === "fondo") {
        toast.success(
          `${inv.nombre}: ${money(r.valor, r.moneda)}${de} (VL ${money(r.vl, r.moneda)})`,
        );
      } else {
        toast.success(
          `${inv.nombre}: ${money(r.valor, r.moneda)}/ud${de}`,
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo actualizar la cotizacion",
      );
    }
  };

  // Actualiza todas las posiciones cotizables (activas) y muestra un resumen.
  const handleRefreshAll = async () => {
    const objetivo = investments.filter(cotizable);
    if (objetivo.length === 0) {
      toast.info("No hay posiciones con ticker para cotizar.");
      return;
    }
    // Tipos de cambio frescos una sola vez para todo el lote.
    const useRates = await getFreshRates();
    let ok = 0;
    const fallos: string[] = [];
    for (const inv of objetivo) {
      try {
        await refreshQuote({ inv, rates: useRates });
        ok++;
      } catch {
        fallos.push(inv.ticker ?? inv.nombre);
      }
    }
    if (fallos.length === 0) {
      toast.success(`${ok} cotizaciones actualizadas`);
    } else {
      toast.warning(
        `${ok} actualizadas · ${fallos.length} fallaron: ${fallos.join(", ")}`,
      );
    }
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
            <TableHead className="w-[190px] text-right">Acciones</TableHead>
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
                  <div className="font-medium flex items-center gap-2">
                    {inv.nombre}
                    {inv.tasaInteres != null && inv.tasaInteres > 0 && (
                      <Badge
                        variant="outline"
                        className="border-primary/30 text-primary text-xs"
                      >
                        {inv.tasaInteres.toLocaleString("es-ES", {
                          maximumFractionDigits: 2,
                        })}
                        % TAE
                      </Badge>
                    )}
                  </div>
                  {(inv.ticker || inv.isin || brokerAlias) && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {[inv.ticker, inv.isin, brokerAlias]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </TableCell>
                {showParticipaciones && (
                  <TableCell className="text-right tabular-nums">
                    {usaParticipaciones(inv.tipo)
                      ? mask(
                          inv.participaciones.toLocaleString("es-ES", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 6,
                          }),
                        )
                      : "—"}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">
                  <div className="font-medium">
                    {money(m.costeTotal, inv.moneda)}
                  </div>
                  {usaParticipaciones(inv.tipo) && (
                    <div className="text-xs text-muted-foreground">
                      {money(inv.precioCompra, inv.moneda)}/ud
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {money(m.valorActual, inv.moneda)}
                  {/* Aviso de precio viejo: solo si esta envejecido y la
                      posicion se valora por precio (no por TAE, que se
                      revaloriza sola). */}
                  {!(inv.tasaInteres && inv.tasaInteres > 0) &&
                    (() => {
                      const lvl = stalenessLevel(inv.ultimaActualizacionPrecio, {
                        warnDays: 3,
                        staleDays: 8,
                      });
                      if (lvl !== "warn" && lvl !== "stale") return null;
                      return (
                        <div
                          className={cn(
                            "text-xs font-normal",
                            lvl === "stale"
                              ? "text-red-500"
                              : "text-amber-500",
                          )}
                          title="Precio sin actualizar; pulsa el boton de refrescar"
                        >
                          {timeAgo(inv.ultimaActualizacionPrecio)}
                        </div>
                      );
                    })()}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    plPositive ? "text-primary" : "text-destructive",
                  )}
                >
                  <div>
                    {plPositive ? "+" : ""}
                    {money(m.plAbsoluto, inv.moneda)}
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
                    money(valorEnVista, viewCurrency)
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
                        {cotizable(inv) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRefreshQuote(inv)}
                            disabled={isRefreshingQuote}
                            aria-label="Actualizar cotizacion"
                            title={
                              inv.ultimaActualizacionPrecio
                                ? `Cotización (API) · última: ${new Date(
                                    inv.ultimaActualizacionPrecio,
                                  ).toLocaleString("es-ES")}`
                                : "Actualizar cotización (API)"
                            }
                          >
                            <DownloadCloud className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openValueUpdate(inv)}
                          aria-label="Actualizar valor"
                          title="Actualizar valor a mano"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setContributionsFor(inv)}
                          aria-label="Aportaciones"
                          title="Aportaciones: histórico y aportación periódica"
                          data-tour="inv-aportaciones"
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
          {investments.some(cotizable) && (
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              disabled={isRefreshingQuote}
            >
              <DownloadCloud
                className={cn(
                  "mr-2 h-4 w-4",
                  isRefreshingQuote && "animate-pulse",
                )}
              />
              Actualizar cotizaciones
            </Button>
          )}
          <Button
            data-tour="inv-nueva"
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
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        data-tour="inv-resumen"
      >
        <KpiPortfolio
          icon={Banknote}
          label="Valor cartera"
          value={money(portfolio.valorActualVista, viewCurrency)}
          hint={`${portfolio.numPosiciones} posiciones`}
        />
        <KpiPortfolio
          icon={PieIcon}
          label="Coste total invertido"
          value={money(portfolio.costeTotalVista, viewCurrency)}
        />
        <KpiPortfolio
          icon={portfolio.plAbsolutoVista >= 0 ? TrendingUp : TrendingDown}
          label="Plusvalia"
          value={`${portfolio.plAbsolutoVista >= 0 ? "+" : ""}${money(
            portfolio.plAbsolutoVista,
            viewCurrency,
          )}`}
          intent={portfolio.plAbsolutoVista >= 0 ? "positive" : "negative"}
          hint={`${(portfolio.plPorcentaje * 100).toFixed(2)}%`}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            // Al editar solo se tocan los metadatos + el valor actual.
            // En modo participaciones el campo viene como PRECIO POR UNIDAD;
            // en modo dinero, como VALOR TOTAL (que dividimos entre
            // participaciones para obtener el precio por unidad cacheado).
            const usaPart = usaParticipaciones(editing.tipo);
            const precioActual = usaPart
              ? data.valorActual
              : editing.participaciones > 0
                ? data.valorActual / editing.participaciones
                : 0;
            // Si el usuario cambia el valor actual al editar (lapiz), sellamos
            // la fecha de actualizacion igual que el boton "Actualizar valor",
            // para que el aviso de "precio sin actualizar" desaparezca. Si no
            // toca el valor, no la tocamos.
            const precioCambio =
              Math.abs(precioActual - editing.precioActual) > 1e-9;
            // Lote 16: TAE. Si la inversion pasa de "sin TAE" a "con TAE",
            // fijamos ultimoInteresAplicado=now para no aplicar retroactivos.
            const tasaInteresNueva =
              data.tasaInteres && data.tasaInteres > 0
                ? data.tasaInteres
                : null;
            const teniaTae = (editing.tasaInteres ?? 0) > 0;
            const ahoraTae = tasaInteresNueva != null;
            const ultimoInteresAplicado =
              ahoraTae && !teniaTae
                ? new Date()
                : editing.ultimoInteresAplicado;
            await update({
              id: editing.id,
              patch: {
                tipo: data.tipo,
                ticker: data.ticker ?? null,
                isin: data.isin ?? null,
                nombre: data.nombre,
                moneda: data.moneda,
                precioActual,
                unidadesCotizacion: data.unidadesCotizacion ?? null,
                notas: data.notas ?? null,
                tasaInteres: tasaInteresNueva,
                frecuenciaInteres: ahoraTae
                  ? (data.frecuenciaInteres ?? "mensual")
                  : null,
                interesCompuesto: ahoraTae
                  ? (data.interesCompuesto ?? true)
                  : null,
                ultimoInteresAplicado,
                ...(precioCambio
                  ? { ultimaActualizacionPrecio: new Date() }
                  : {}),
              },
            });
          } else {
            // Modo participaciones (Acciones/ETF/Cripto): el usuario mete
            // participaciones + precio por unidad + comision (misma filosofia
            // que al anadir una aportacion).
            // Modo "solo dinero" (resto): no hay participaciones; usamos el
            // importe como "unidades" a precio 1 (asi coste y valor cuadran).
            const conPart = usaParticipaciones(data.tipo);
            const part = conPart ? data.participaciones : data.importeInvertido;
            const precioUnitario = conPart ? (data.precioUnitario ?? 0) : 1;
            const comisionInicial = conPart ? (data.comision ?? 0) : 0;
            // Creamos la inversion "vacia" (0); la aportacion inicial fija
            // participaciones, coste y valor actual (asi el valor actual sube
            // exactamente por el importe invertido, sin duplicar).
            const tasaInteresNueva =
              data.tasaInteres && data.tasaInteres > 0
                ? data.tasaInteres
                : null;
            // Crear inversion + primera aportacion de forma ATOMICA: la compra
            // inicial descuenta de la cuenta de origen (movimiento de salida) y
            // deja el historial para el grafico. Si la aportacion fallara, no
            // queda una inversion vacia huerfana.
            await createWithContribution({
              investment: {
                tipo: data.tipo,
                ticker: data.ticker ?? null,
                isin: data.isin ?? null,
                nombre: data.nombre,
                unidadesCotizacion: data.unidadesCotizacion ?? null,
                participaciones: 0,
                precioCompra: 0,
                precioActual: 0,
                moneda: data.moneda,
                cuentaId: data.cuentaId ?? null,
                fechaCompra: data.fechaCompra ?? null,
                notas: data.notas ?? null,
                tasaInteres: tasaInteresNueva,
                frecuenciaInteres:
                  tasaInteresNueva != null
                    ? (data.frecuenciaInteres ?? "mensual")
                    : null,
                interesCompuesto:
                  tasaInteresNueva != null
                    ? (data.interesCompuesto ?? true)
                    : null,
                ultimoInteresAplicado: null,
              },
              contribution: {
                fecha: data.fechaCompra ?? new Date(),
                participaciones: part,
                precioUnitario,
                comision: comisionInicial,
                cuentaOrigenId: data.cuentaId ?? null,
              },
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
              {valueFor?.nombre}:{" "}
              {valueFor && usaParticipaciones(valueFor.tipo)
                ? "indica el precio HOY por unidad (como cotiza)."
                : "indica cuanto vale HOY en total."}{" "}
              No mueve dinero; solo actualiza el valor de mercado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="valor-actual-input">
              {valueFor && usaParticipaciones(valueFor.tipo)
                ? `Precio por unidad (${valueFor.moneda})`
                : `Valor total (${valueFor?.moneda})`}
            </Label>
            <Input
              id="valor-actual-input"
              type="number"
              step="0.000001"
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
