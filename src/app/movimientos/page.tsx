"use client";

/**
 * ============================================================================
 *  src/app/movimientos/page.tsx
 * ============================================================================
 *
 *  Pantalla unica para todos los movimientos. Tabs por tipo + filtro de
 *  periodo (mes/anio).
 *
 *  Tabs: Todos, Gastos, Ingresos, Transferencias, Ajustes
 *
 *  Cada tab es la misma tabla con un filtro distinto. La tabla muestra:
 *    Fecha · Tipo · Concepto · Categoria/Cuentas · Importe · Acciones
 *
 *  El boton "+ Movimiento" abre el formulario con tab segun el tipo
 *  actualmente seleccionado en la pagina.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Settings2,
  Sparkles,
  Clock,
  Undo2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useRefundTotals } from "@/hooks/useRefunds";
import { useInvestments } from "@/hooks/useInvestments";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { useRepos } from "@/contexts/DatabaseProvider";
import { occurrencesForRule } from "@/lib/domain/recurring";
import type { RecurringRule } from "@/lib/db/schema";
import { MovementFormDialog } from "@/components/forms/MovementFormDialog";
import { RefundsDialog } from "@/components/forms/RefundsDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
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
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Movement } from "@/lib/db/schema";
import type { MovementType, CreateMovementData } from "@/lib/repositories";
import { formatAmount, buildRatesMap, convert } from "@/lib/domain/currency";
import { parseTags, allTags, hasTag } from "@/lib/domain/tags";
import { normalizeConcepto } from "@/lib/domain/category-suggest";
import { costeReal, sumRefundsInCurrency } from "@/lib/domain/refunds";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type TabKey = "todos" | "gasto" | "ingreso" | "transferencia" | "ajuste";
type SortKey = "fecha" | "concepto" | "importe" | "categoria";
type SortDir = "asc" | "desc";
type Periodo = { anio: number; mes: number };

// Indice absoluto de mes (anio*12 + mes-1), para comparar/ordenar periodos.
const periodoKey = (p: Periodo): number => p.anio * 12 + (p.mes - 1);

// Desplaza un periodo `delta` meses (negativo hacia atras).
const shiftPeriodo = (p: Periodo, delta: number): Periodo => {
  const idx = periodoKey(p) + delta;
  return { anio: Math.floor(idx / 12), mes: (idx % 12) + 1 };
};

export default function MovimientosPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { investments } = useInvestments();
  const repos = useRepos();

  // Mapa movimientoId -> nombre de la inversion, para etiquetar las
  // transferencias de aportacion/retirada (que no tienen cuenta destino/origen).
  const { data: allContribs = [] } = useQuery({
    queryKey: ["investmentContributions", "all"],
    queryFn: () => repos.investmentContributions.listAll(),
  });

  // Siempre el mes ACTUAL al arrancar (no se persiste).
  const [periodAnio, setPeriodAnio] = useState<number>(today.getFullYear());
  const [periodMes, setPeriodMes] = useState<number | null>(
    today.getMonth() + 1,
  );

  // Modo de periodo: un solo MES (como siempre) o un RANGO de meses
  // (desde/hasta), para consultar p.ej. "transporte desde marzo hasta hoy".
  const [periodMode, setPeriodMode] = useState<"mes" | "rango">("mes");
  const [desde, setDesde] = useState<Periodo>({
    anio: today.getFullYear(),
    mes: today.getMonth() + 1,
  });
  const [hasta, setHasta] = useState<Periodo>({
    anio: today.getFullYear(),
    mes: today.getMonth() + 1,
  });

  // Atajos de rango: fijan desde/hasta (y pasan a modo rango).
  const applyPreset = (key: string) => {
    const cur: Periodo = { anio: today.getFullYear(), mes: today.getMonth() + 1 };
    if (key === "3m") setDesde(shiftPeriodo(cur, -2));
    else if (key === "6m") setDesde(shiftPeriodo(cur, -5));
    else if (key === "12m") setDesde(shiftPeriodo(cur, -11));
    else if (key === "ytd") setDesde({ anio: cur.anio, mes: 1 });
    else if (key === "prev-year") {
      setDesde({ anio: cur.anio - 1, mes: 1 });
      setHasta({ anio: cur.anio - 1, mes: 12 });
      return;
    }
    if (key !== "prev-year") setHasta(cur);
  };

  const [tab, setTab] = useState<TabKey>("todos");
  // Filtro por etiqueta (en cliente). null = sin filtro.
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  // Busqueda de texto (concepto + categoria + etiquetas) y orden.
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: SortKey) => {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      // Por defecto: fecha e importe de mayor a menor; texto de la A a la Z.
      setSortDir(col === "concepto" || col === "categoria" ? "asc" : "desc");
    }
  };

  // El filtro de tipo se aplica en cliente (mas flexible para el tab "todos").
  // En modo RANGO traemos por rango de ANIOS (ya soportado por el repo) y luego
  // acotamos a la ventana exacta de meses en cliente (ver listaBase).
  const filter = useMemo(() => {
    if (periodMode === "rango") {
      const lo = Math.min(desde.anio, hasta.anio);
      const hi = Math.max(desde.anio, hasta.anio);
      return { anioDesde: lo, anioHasta: hi };
    }
    return { anio: periodAnio, mes: periodMes ?? undefined };
  }, [periodMode, periodAnio, periodMes, desde, hasta]);

  const { movements, isLoading, create, update, remove, isMutating } =
    useMovements(filter);

  // Las devoluciones ASOCIADAS a un gasto no se listan como movimiento propio:
  // las gestiona el gasto (que muestra su coste real). Las devoluciones SUELTAS
  // (sin gasto asociado) si aparecen, como hasta ahora.
  const listaBase = useMemo(() => {
    let arr = movements.filter(
      (m) => !(m.tipo === "devolucion" && m.gastoAsociadoId),
    );
    if (periodMode === "rango") {
      const a = Math.min(periodoKey(desde), periodoKey(hasta));
      const b = Math.max(periodoKey(desde), periodoKey(hasta));
      arr = arr.filter((m) => {
        const k = m.anio * 12 + (m.mes - 1);
        return k >= a && k <= b;
      });
    }
    return arr;
  }, [movements, periodMode, desde, hasta]);

  // Filtramos por tab y por etiqueta en cliente
  const visibleMovements = useMemo(() => {
    let list = listaBase;
    if (tab === "gasto") {
      list = list.filter(
        (m) =>
          m.tipo === "gasto" || m.tipo === "cuota" || m.tipo === "devolucion",
      );
    } else if (tab === "ingreso") {
      list = list.filter((m) => m.tipo === "ingreso" || m.tipo === "intereses");
    } else if (tab === "transferencia") {
      list = list.filter((m) => m.tipo === "transferencia");
    } else if (tab === "ajuste") {
      list = list.filter((m) => m.tipo === "ajuste");
    }
    if (tagFiltro) list = list.filter((m) => hasTag(m.etiquetas, tagFiltro));
    return list;
  }, [listaBase, tab, tagFiltro]);

  // Etiquetas disponibles en el periodo.
  const tagsDisponibles = useMemo(() => allTags(listaBase), [listaBase]);
  const viewCurrency = settings?.monedaVista ?? "EUR";
  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));

  // Contadores por tab
  const counts = useMemo(() => {
    const c = {
      todos: listaBase.length,
      gasto: 0,
      ingreso: 0,
      transferencia: 0,
      ajuste: 0,
    };
    for (const m of listaBase) {
      if (m.tipo === "gasto" || m.tipo === "cuota" || m.tipo === "devolucion")
        c.gasto++;
      else if (m.tipo === "ingreso" || m.tipo === "intereses") c.ingreso++;
      else if (m.tipo === "transferencia") c.transferencia++;
      else if (m.tipo === "ajuste") c.ajuste++;
    }
    return c;
  }, [listaBase]);

  // Helpers para mostrar
  const catById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.nombre;
    return m;
  }, [categories]);

  // Nombre de categoria (o texto libre) de un movimiento, para buscar/ordenar.
  const catNameOf = (m: Movement): string =>
    (m.categoriaId ? catById[m.categoriaId] : null) ?? m.categoriaTexto ?? "";

  // Importe convertido a moneda vista (para ordenar por cantidad y sumar).
  const importeVista = (m: Movement): number => {
    try {
      return convert(m.importe, m.moneda, viewCurrency, rates);
    } catch {
      return 0;
    }
  };

  // Pipeline final: sobre lo visible (tab + etiqueta) aplicamos BUSQUEDA de
  // texto y ORDEN. La busqueda casa por concepto + categoria + etiquetas,
  // exigiendo que aparezcan todas las palabras escritas (sin tildes ni mayus).
  const procesados = useMemo(() => {
    const tokens = normalizeConcepto(search).split(" ").filter(Boolean);
    let list = visibleMovements;
    if (tokens.length) {
      list = list.filter((m) => {
        const hay = normalizeConcepto(
          `${m.concepto} ${catNameOf(m)} ${m.etiquetas ?? ""}`,
        );
        return tokens.every((t) => hay.includes(t));
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...list];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "concepto") {
        cmp = a.concepto.localeCompare(b.concepto, "es");
      } else if (sortKey === "categoria") {
        cmp = catNameOf(a).localeCompare(catNameOf(b), "es");
      } else if (sortKey === "importe") {
        cmp = importeVista(a) - importeVista(b);
      } else {
        cmp = +new Date(a.fecha) - +new Date(b.fecha);
      }
      // Desempate estable por fecha (mas nuevo primero).
      if (cmp === 0) cmp = +new Date(b.fecha) - +new Date(a.fecha);
      return cmp * dir;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMovements, search, sortKey, sortDir, catById, rates, viewCurrency]);

  // Devoluciones por gasto (importe+moneda), para el coste real de cada gasto.
  const { data: refundsByGasto = {} } = useRefundTotals();

  // GASTO NETO de lo visible, en moneda vista: solo gastos/cuotas por su coste
  // real (importe menos sus devoluciones asociadas). Las devoluciones SUELTAS
  // (sin gasto) restan. Ingresos, transferencias, aportaciones y ajustes no
  // suman nada. (Las devoluciones asociadas ya no aparecen: las lleva el gasto.)
  const totalVista = useMemo(() => {
    let t = 0;
    for (const m of procesados) {
      if (m.tipo === "gasto" || m.tipo === "cuota") {
        const dev = sumRefundsInCurrency(
          refundsByGasto[m.id] ?? [],
          viewCurrency,
          rates,
        );
        t += Math.max(0, importeVista(m) - dev);
      } else if (m.tipo === "devolucion") {
        t -= importeVista(m);
      }
      // ingreso, intereses, transferencia, ajuste -> 0
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesados, refundsByGasto, rates, viewCurrency]);

  const accById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of accounts) m[a.id] = a.alias;
    return m;
  }, [accounts]);

  const invNameByMovId = useMemo(() => {
    const nameByInv: Record<string, string> = {};
    for (const inv of investments) nameByInv[inv.id] = inv.nombre;
    const map: Record<string, string> = {};
    for (const c of allContribs) {
      if (c.movimientoId) {
        map[c.movimientoId] = nameByInv[c.investmentId] ?? "Inversion";
      }
    }
    return map;
  }, [investments, allContribs]);

  // Movimientos PREVISTOS: ocurrencias futuras de reglas recurrentes (no
  // investment) que aun no se han materializado, filtradas al periodo
  // seleccionado. Independiente de si el mes es el actual o uno futuro.
  const { data: activeRules = [] } = useActiveRecurringRules();
  const upcomings = useMemo(() => {
    const nowMs = today.getTime();
    const items: Array<{
      rule: RecurringRule;
      fecha: Date;
      anio: number;
      mes: number;
    }> = [];
    const meses = periodMes != null ? [periodMes] : Array.from({ length: 12 }, (_, i) => i + 1);
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      for (const mes of meses) {
        // Todas las ocurrencias del mes (semanal/diaria/varios-mes pueden dar
        // varias).
        for (const occ of occurrencesForRule(rule, periodAnio, mes)) {
          if (occ.getTime() <= nowMs) continue;
          items.push({ rule, fecha: occ, anio: periodAnio, mes });
        }
      }
    }
    items.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return items;
  }, [activeRules, periodAnio, periodMes, today]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [toDelete, setToDelete] = useState<Movement | null>(null);
  const [refundsFor, setRefundsFor] = useState<Movement | null>(null);

  const tabToFormTipo = (
    t: TabKey,
  ): "gasto" | "ingreso" | "transferencia" => {
    if (t === "ingreso") return "ingreso";
    if (t === "transferencia") return "transferencia";
    return "gasto"; // todos | ajuste | gasto
  };

  const handleSubmit = async (data: CreateMovementData) => {
    if (editing) {
      await update({ id: editing.id, patch: data });
    } else {
      await create(data);
    }
    setEditing(null);
  };

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Todos los gastos, ingresos, transferencias y ajustes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Modo mes / rango */}
          <div
            className="inline-flex items-center rounded-md border p-0.5"
            data-tour="mov-modo"
          >
            <Button
              size="sm"
              variant={periodMode === "mes" ? "secondary" : "ghost"}
              className="h-7 px-2.5"
              onClick={() => setPeriodMode("mes")}
            >
              Mes
            </Button>
            <Button
              size="sm"
              variant={periodMode === "rango" ? "secondary" : "ghost"}
              className="h-7 px-2.5"
              onClick={() => setPeriodMode("rango")}
            >
              Rango
            </Button>
          </div>

          {periodMode === "mes" ? (
            <PeriodSelector
              anio={periodAnio}
              mes={periodMes ?? new Date().getMonth() + 1}
              onChange={({ anio, mes }) => {
                setPeriodAnio(anio);
                setPeriodMes(mes);
              }}
            />
          ) : (
            <>
              <div className="inline-flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Desde</span>
                <PeriodSelector
                  anio={desde.anio}
                  mes={desde.mes}
                  onChange={setDesde}
                />
              </div>
              <div className="inline-flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Hasta</span>
                <PeriodSelector
                  anio={hasta.anio}
                  mes={hasta.mes}
                  onChange={setHasta}
                />
              </div>
              <Select value="" onValueChange={applyPreset}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue placeholder="Atajos…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="12m">Últimos 12 meses</SelectItem>
                  <SelectItem value="ytd">Este año</SelectItem>
                  <SelectItem value="prev-year">Año pasado</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          <Button
            data-tour="mov-nuevo"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Movimiento
          </Button>
        </div>
      </header>

      {periodMode === "mes" && upcomings.length > 0 && (
        <Card className="border-dashed" data-tour="mov-proximos">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Proximos en este periodo
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums font-normal">
                {upcomings.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomings.map((u, idx) => (
                  <UpcomingRow
                    key={`${u.rule.id}-${u.anio}-${u.mes}-${idx}`}
                    rule={u.rule}
                    fecha={u.fecha}
                    accById={accById}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {procesados.length} movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="mb-4 grid w-full grid-cols-5" data-tour="mov-tabs">
              <TabTrigger value="todos" label="Todos" count={counts.todos} />
              <TabTrigger value="gasto" label="Gastos" count={counts.gasto} />
              <TabTrigger value="ingreso" label="Ingresos" count={counts.ingreso} />
              <TabTrigger
                value="transferencia"
                label="Transferencias"
                count={counts.transferencia}
              />
              <TabTrigger value="ajuste" label="Ajustes" count={counts.ajuste} />
            </TabsList>
          </Tabs>

          {/* Buscador + total de lo que se esta viendo */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1" data-tour="mov-buscar">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por concepto, categoría o etiqueta…"
                className="pl-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div
              className="text-sm text-muted-foreground tabular-nums"
              data-tour="mov-total"
            >
              {procesados.length} mov · gasto neto{" "}
              <span className="font-medium text-foreground">
                {money(totalVista, viewCurrency)}
              </span>
            </div>
          </div>

          {tagsDisponibles.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Etiquetas:</span>
              {tagsDisponibles.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFiltro(tagFiltro === t ? null : t)}
                >
                  <Badge
                    variant={tagFiltro === t ? "default" : "secondary"}
                    className="cursor-pointer"
                  >
                    {t}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {!isLoading && procesados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search.trim()
                ? "Ningún movimiento coincide con la búsqueda."
                : "No hay movimientos en este periodo."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow data-tour="mov-ordenar">
                  <TableHead className="w-[110px]">
                    <SortHeader
                      label="Fecha"
                      col="fecha"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>
                    <SortHeader
                      label="Concepto"
                      col="concepto"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader
                      label="Categoria / Cuentas"
                      col="categoria"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Importe"
                      col="importe"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      align="right"
                    />
                  </TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procesados.map((m) => (
                  <MovementRow
                    key={m.id}
                    m={m}
                    catById={catById}
                    accById={accById}
                    invNameByMovId={invNameByMovId}
                    onEdit={() => {
                      setEditing(m);
                      setFormOpen(true);
                    }}
                    onDelete={() => setToDelete(m)}
                    totalDevuelto={sumRefundsInCurrency(
                      refundsByGasto[m.id] ?? [],
                      m.moneda,
                      rates,
                    )}
                    onRefunds={() => setRefundsFor(m)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MovementFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        initialTipo={tabToFormTipo(tab)}
        currencies={currencies}
        categories={categories}
        accounts={accounts}
        monedaLocal={settings.monedaLocal}
        defaultAccountId={settings.cuentaPorDefectoId ?? null}
        loading={isMutating}
        onSubmit={handleSubmit}
      />

      <RefundsDialog
        open={!!refundsFor}
        onOpenChange={(v) => !v && setRefundsFor(null)}
        gasto={refundsFor}
        accounts={accounts}
        accById={accById}
        currencies={currencies}
        defaultAccountId={settings.cuentaPorDefectoId ?? null}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar movimiento"
        description={
          toDelete
            ? `"${toDelete.concepto}" pasara a la papelera.`
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

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === col;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        align === "right" && "flex-row-reverse",
        active ? "text-foreground" : "",
      )}
    >
      {label}
      <Icon
        className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
}

function TabTrigger({
  value,
  label,
  count,
}: {
  value: TabKey;
  label: string;
  count: number;
}) {
  return (
    <TabsTrigger value={value} className="data-[state=active]:bg-primary/10">
      {label}
      <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
        {count}
      </span>
    </TabsTrigger>
  );
}

function MovementRow({
  m,
  catById,
  accById,
  invNameByMovId,
  onEdit,
  onDelete,
  totalDevuelto,
  onRefunds,
}: {
  m: Movement;
  catById: Record<string, string>;
  accById: Record<string, string>;
  invNameByMovId: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  totalDevuelto: number;
  onRefunds: () => void;
}) {
  const tipoMeta = getTipoMeta(m.tipo);
  const mask = useMaskMoney();
  const fecha = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
  // Las devoluciones se asocian a gastos (y cuotas). El resto de tipos no.
  const esGasto = m.tipo === "gasto" || m.tipo === "cuota";

  return (
    <TableRow>
      <TableCell className="tabular-nums text-sm text-muted-foreground">
        {formatDateLong(fecha)}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("gap-1", tipoMeta.className)}
        >
          <tipoMeta.icon className="h-3 w-3" />
          {tipoMeta.label}
          {m.esAutomatico && (
            <Sparkles className="h-3 w-3 ml-1 opacity-60" aria-label="Automatico" />
          )}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        {m.concepto}
        {m.etiquetas && (
          <div className="mt-1 flex flex-wrap gap-1">
            {parseTags(m.etiquetas).map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-normal"
              >
                {t}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {renderCategoriaOCuentas(m, catById, accById, invNameByMovId)}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums font-medium", tipoMeta.amountClass)}>
        {tipoMeta.amountSign}
        {mask(formatAmount(m.importe, m.moneda))}
        {esGasto && totalDevuelto > 0 && (
          <div className="text-xs font-normal text-muted-foreground">
            −{mask(formatAmount(totalDevuelto, m.moneda))} dev. · real{" "}
            <span className="font-medium text-foreground">
              {mask(formatAmount(costeReal(m.importe, totalDevuelto), m.moneda))}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {esGasto && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefunds}
              aria-label="Devoluciones"
              title="Devoluciones de este gasto"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Borrar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function renderCategoriaOCuentas(
  m: Movement,
  catById: Record<string, string>,
  accById: Record<string, string>,
  invNameByMovId: Record<string, string>,
): string {
  if (m.tipo === "transferencia") {
    // Las aportaciones/retiradas de inversion son transferencias sin cuenta
    // destino/origen: en su lugar mostramos el nombre de la inversion.
    const inv = invNameByMovId[m.id];
    const o = m.cuentaOrigenId ? accById[m.cuentaOrigenId] ?? "?" : inv ?? "?";
    const d = m.cuentaDestinoId ? accById[m.cuentaDestinoId] ?? "?" : inv ?? "?";
    return `${o} → ${d}`;
  }
  if (m.tipo === "ingreso" || m.tipo === "intereses") {
    const cat = m.categoriaTexto ?? "Ingreso";
    const cuenta = m.cuentaDestinoId ? ` · ${accById[m.cuentaDestinoId] ?? "?"}` : "";
    return `${cat}${cuenta}`;
  }
  if (m.tipo === "gasto" || m.tipo === "cuota") {
    const cat = m.categoriaId ? catById[m.categoriaId] ?? "?" : "?";
    const cuenta = m.cuentaOrigenId ? ` · ${accById[m.cuentaOrigenId] ?? "?"}` : "";
    return `${cat}${cuenta}`;
  }
  if (m.tipo === "devolucion") {
    // El dinero entra en la cuenta destino; la categoria es la que compensa.
    const cat = m.categoriaId ? catById[m.categoriaId] ?? "?" : "?";
    const cuenta = m.cuentaDestinoId
      ? ` · ${accById[m.cuentaDestinoId] ?? "?"}`
      : "";
    return `${cat}${cuenta}`;
  }
  if (m.tipo === "ajuste") {
    const cuenta =
      (m.cuentaOrigenId ? accById[m.cuentaOrigenId] : null) ??
      (m.cuentaDestinoId ? accById[m.cuentaDestinoId] : null) ??
      "?";
    return `Conciliacion · ${cuenta}`;
  }
  return "";
}

function UpcomingRow({
  rule,
  fecha,
  accById,
}: {
  rule: RecurringRule;
  fecha: Date;
  accById: Record<string, string>;
}) {
  const mask = useMaskMoney();
  const tipoMeta = getTipoMeta(rule.tipoMovimiento);
  // La cuenta a mostrar segun el tipo del movimiento: para gastos/cuotas la
  // cuenta origen, para ingresos/intereses la destino, para transferencias
  // origen → destino.
  const cuenta =
    rule.tipoMovimiento === "transferencia"
      ? `${rule.cuentaOrigenId ? (accById[rule.cuentaOrigenId] ?? "?") : "?"} → ${
          rule.cuentaDestinoId ? (accById[rule.cuentaDestinoId] ?? "?") : "?"
        }`
      : rule.cuentaOrigenId
        ? (accById[rule.cuentaOrigenId] ?? "?")
        : rule.cuentaDestinoId
          ? (accById[rule.cuentaDestinoId] ?? "?")
          : "—";

  return (
    <TableRow className="text-muted-foreground">
      <TableCell className="tabular-nums text-sm">{formatDateLong(fecha)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("gap-1 opacity-70", tipoMeta.className)}>
          <tipoMeta.icon className="h-3 w-3" />
          {tipoMeta.label}
          <Clock className="h-3 w-3 ml-1 opacity-60" aria-label="Previsto" />
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{rule.nombre}</TableCell>
      <TableCell className="text-sm">{cuenta}</TableCell>
      <TableCell className={cn("text-right tabular-nums font-medium", tipoMeta.amountClass, "opacity-80")}>
        {tipoMeta.amountSign}
        {mask(formatAmount(rule.importe, rule.moneda))}
      </TableCell>
    </TableRow>
  );
}

function getTipoMeta(tipo: MovementType) {
  switch (tipo) {
    case "gasto":
    case "cuota":
      return {
        label: tipo === "cuota" ? "Cuota" : "Gasto",
        icon: ArrowDown,
        className: "border-destructive/30 text-destructive",
        amountClass: "text-destructive",
        amountSign: "-",
      };
    case "ingreso":
    case "intereses":
      return {
        label: tipo === "intereses" ? "Intereses" : "Ingreso",
        icon: ArrowUp,
        className: "border-primary/30 text-primary",
        amountClass: "text-primary",
        amountSign: "+",
      };
    case "devolucion":
      return {
        label: "Devolución",
        icon: Undo2,
        className:
          "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        amountClass: "text-emerald-600 dark:text-emerald-400",
        amountSign: "+",
      };
    case "transferencia":
      return {
        label: "Transfer.",
        icon: ArrowLeftRight,
        className: "border-blue-500/30 text-blue-600 dark:text-blue-400",
        amountClass: "",
        amountSign: "",
      };
    case "ajuste":
      return {
        label: "Ajuste",
        icon: Settings2,
        className: "border-amber-500/30 text-amber-600 dark:text-amber-400",
        amountClass: "",
        amountSign: "",
      };
  }
}
