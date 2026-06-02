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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMovements } from "@/hooks/useMovements";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { useRepos } from "@/contexts/DatabaseProvider";
import { computeUpcomingFromRule } from "@/lib/domain/recurring";
import type { RecurringRule } from "@/lib/db/schema";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { MovementFormDialog } from "@/components/forms/MovementFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import { Button } from "@/components/ui/button";
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
import { formatAmount } from "@/lib/domain/currency";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type TabKey = "todos" | "gasto" | "ingreso" | "transferencia" | "ajuste";

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

  const [periodAnio, setPeriodAnio] = useLocalStorage<number>(
    "mov:anio",
    settings?.anioActual ?? today.getFullYear(),
  );
  const [periodMes, setPeriodMes] = useLocalStorage<number | null>(
    "mov:mes",
    settings?.mesActual ?? today.getMonth() + 1,
  );

  const [tab, setTab] = useState<TabKey>("todos");

  // El filtro de tipo se aplica en cliente (mas flexible para el tab "todos")
  const filter = useMemo(
    () => ({
      anio: periodAnio,
      mes: periodMes ?? undefined,
    }),
    [periodAnio, periodMes],
  );

  const { movements, isLoading, create, update, remove, isMutating } =
    useMovements(filter);

  // Filtramos por tab en cliente
  const visibleMovements = useMemo(() => {
    if (tab === "todos") return movements;
    if (tab === "gasto") {
      return movements.filter((m) => m.tipo === "gasto" || m.tipo === "cuota");
    }
    if (tab === "ingreso") {
      return movements.filter(
        (m) => m.tipo === "ingreso" || m.tipo === "intereses",
      );
    }
    if (tab === "transferencia") {
      return movements.filter((m) => m.tipo === "transferencia");
    }
    if (tab === "ajuste") {
      return movements.filter((m) => m.tipo === "ajuste");
    }
    return movements;
  }, [movements, tab]);

  // Contadores por tab
  const counts = useMemo(() => {
    const c = {
      todos: movements.length,
      gasto: 0,
      ingreso: 0,
      transferencia: 0,
      ajuste: 0,
    };
    for (const m of movements) {
      if (m.tipo === "gasto" || m.tipo === "cuota") c.gasto++;
      else if (m.tipo === "ingreso" || m.tipo === "intereses") c.ingreso++;
      else if (m.tipo === "transferencia") c.transferencia++;
      else if (m.tipo === "ajuste") c.ajuste++;
    }
    return c;
  }, [movements]);

  // Helpers para mostrar
  const catById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.nombre;
    return m;
  }, [categories]);

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
  // investment) que aun no se han materializado. Solo se muestran si el
  // periodo seleccionado abarca dias futuros.
  const { data: activeRules = [] } = useActiveRecurringRules();
  const upcomings = useMemo(() => {
    const now = today;
    // Horizonte: hasta fin del periodo seleccionado.
    const endOfPeriod = periodMes
      ? new Date(periodAnio, periodMes, 0, 23, 59, 59) // ultimo dia del mes
      : new Date(periodAnio, 11, 31, 23, 59, 59); // fin del anio
    if (endOfPeriod.getTime() <= now.getTime()) return [];
    const daysAhead = Math.ceil(
      (endOfPeriod.getTime() - now.getTime()) / (1000 * 3600 * 24),
    );
    const items: Array<{
      rule: RecurringRule;
      fecha: Date;
      anio: number;
      mes: number;
    }> = [];
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      const upcoming = computeUpcomingFromRule(rule, now, daysAhead);
      for (const u of upcoming) {
        if (u.anio !== periodAnio) continue;
        if (periodMes != null && u.mes !== periodMes) continue;
        items.push({ rule, ...u });
      }
    }
    items.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return items;
  }, [activeRules, periodAnio, periodMes, today]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [toDelete, setToDelete] = useState<Movement | null>(null);

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
        <div className="flex items-center gap-2">
          <PeriodSelector
            anio={periodAnio}
            mes={periodMes ?? new Date().getMonth() + 1}
            onChange={({ anio, mes }) => {
              setPeriodAnio(anio);
              setPeriodMes(mes);
            }}
          />
          <Button
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

      {upcomings.length > 0 && (
        <Card className="border-dashed">
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
            {visibleMovements.length} movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="mb-4 grid w-full grid-cols-5">
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

          {!isLoading && visibleMovements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay movimientos en este periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoria / Cuentas</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMovements.map((m) => (
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
}: {
  m: Movement;
  catById: Record<string, string>;
  accById: Record<string, string>;
  invNameByMovId: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tipoMeta = getTipoMeta(m.tipo);
  const fecha = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);

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
      <TableCell className="font-medium">{m.concepto}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {renderCategoriaOCuentas(m, catById, accById, invNameByMovId)}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums font-medium", tipoMeta.amountClass)}>
        {tipoMeta.amountSign}
        {formatAmount(m.importe, m.moneda)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
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
        {formatAmount(rule.importe, rule.moneda)}
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
