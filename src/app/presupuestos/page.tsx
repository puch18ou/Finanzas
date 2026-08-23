"use client";

/**
 * ============================================================================
 *  src/app/presupuestos/page.tsx — Seguimiento de presupuestos (Lote 14a)
 * ============================================================================
 *
 *  Una fila por categoria con presupuesto mensual definido (en /categorias).
 *  Muestra, para el periodo elegido:
 *    - Presupuesto mensual.
 *    - Gastado ESTE mes vs presupuesto mensual.
 *    - Gastado ACUMULADO del ano (enero..mes) vs presupuesto acumulado
 *      (presupuesto mensual x meses transcurridos).
 *
 *  Los presupuestos se SIGUEN definiendo en Categorias; aqui solo se hace el
 *  seguimiento. Todo en moneda de vista.
 * ============================================================================
 */

import { Fragment, useMemo, useState } from "react";
import { Wallet, ChevronRight } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
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
import { Progress } from "@/components/ui/progress";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import {
  filterMovementsByPeriod,
  sumMovementsByCategory,
  listMovementsByCategory,
  previstoItemsByCategory,
  type CategoryMovementItem,
  type PrevistoItem,
} from "@/lib/domain/aggregation";
import { MESES_ES, MESES_ES_CORTO, formatDateLong } from "@/lib/utils/dates";
import { useObjetivoTramos } from "@/hooks/useObjetivoTramos";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { tramosAncla, resolvePresupuesto } from "@/lib/domain/tramos";
import { cn } from "@/lib/utils/cn";

type Row = {
  categoriaId: string;
  nombre: string;
  presupuestoMes: number;
  gastadoMes: number;
  presupuestoAcum: number;
  gastadoAcum: number;
  // Desglose de los gastos de ESTE mes que componen `gastadoMes`, ordenado de
  // mayor a menor, para poder desplegar la fila.
  gastosMes: CategoryMovementItem[];
  // Gastos PREVISTOS del mes (recurrentes aun no generados). Solo se rellena si
  // el periodo mostrado es el mes actual. Ya sumados en gastadoMes/gastadoAcum.
  previstos: PrevistoItem[];
};

export default function PresupuestosPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { tramos: objetivoTramos } = useObjetivoTramos();
  const { tramos: presupuestoTramos } = usePresupuestoTramos();

  // Siempre el mes ACTUAL al arrancar (no se persiste): el periodo activo es
  // siempre el mes en curso. El selector permite navegar durante la sesion.
  const [anio, setAnio] = useState<number>(today.getFullYear());
  const [mes, setMes] = useState<number>(today.getMonth() + 1);
  // Categoria cuya fila esta desplegada (desglose de gastos del mes). Solo una
  // abierta a la vez para que la tabla no crezca sin control.
  const [expandida, setExpandida] = useState<string | null>(null);

  const { movements } = useMovements({ anio });
  const { data: activeRules = [] } = useActiveRecurringRules();

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));

  // Mes de inicio del acumulado dentro del anio visible. Si el objetivo de
  // ahorro arranca en ESTE anio y su mes es <= al mes seleccionado, el
  // acumulado empieza en ese mes (estamos en un mes posterior al objetivo).
  // En cualquier otro caso (sin objetivo, objetivo de otro anio, o mes
  // seleccionado anterior al objetivo) empieza en enero, como hasta ahora.
  const ancla = tramosAncla(objetivoTramos);
  const desdeAnio = ancla?.anio ?? null;
  const desdeMes = ancla?.mes ?? null;
  const startMes =
    desdeAnio === anio && desdeMes != null && desdeMes <= mes ? desdeMes : 1;
  const numMesesAcum = mes - startMes + 1;

  // Cambios de presupuesto con fecha, agrupados por categoria.
  const tramosByCat = useMemo(() => {
    const m: Record<string, typeof presupuestoTramos> = {};
    for (const t of presupuestoTramos) {
      (m[t.categoriaId] ??= []).push(t);
    }
    return m;
  }, [presupuestoTramos]);

  const rows: Row[] = useMemo(() => {
    // Gasto del mes de referencia y gasto acumulado (startMes..mes), por
    // categoria.
    const movsMes = filterMovementsByPeriod(movements, mes, anio);
    const movsAcum = movements.filter(
      (m) => m.anio === anio && m.mes >= startMes && m.mes <= mes,
    );
    const gastadoMesByCat = sumMovementsByCategory(movsMes, rates, viewCurrency);
    const gastadoAcumByCat = sumMovementsByCategory(
      movsAcum,
      rates,
      viewCurrency,
    );
    const gastosMesByCat = listMovementsByCategory(movsMes, rates, viewCurrency);

    // Gastos PREVISTOS del mes (recurrentes aun no generados). Solo aplican si
    // el periodo mostrado es el mes ACTUAL real. Se suman al gastado del mes y,
    // como el mes actual entra en el acumulado, tambien al acumulado.
    const now = new Date();
    const esMesActual =
      anio === now.getFullYear() && mes === now.getMonth() + 1;
    const previstosByCat = esMesActual
      ? previstoItemsByCategory(activeRules, anio, mes, now, rates, viewCurrency)
      : {};
    const previstoTotalByCat: Record<string, number> = {};
    for (const [catId, items] of Object.entries(previstosByCat)) {
      previstoTotalByCat[catId] = items.reduce((s, i) => s + i.valorVista, 0);
    }

    // Presupuesto resuelto y convertido a moneda vista para (anio, m).
    const presView = (c: (typeof categories)[number], m: number): number => {
      const p = resolvePresupuesto(
        tramosByCat[c.id] ?? [],
        c.presupuestoMensual,
        c.presupuestoMoneda,
        anio,
        m,
      );
      if (p.importe <= 0) return 0;
      try {
        return convert(p.importe, p.moneda, viewCurrency, rates);
      } catch {
        return 0;
      }
    };

    return categories
      .filter(
        (c) =>
          c.presupuestoMensual > 0 || (tramosByCat[c.id]?.length ?? 0) > 0,
      )
      .map((c) => {
        let presupuestoAcum = 0;
        for (let m = startMes; m <= mes; m++) presupuestoAcum += presView(c, m);
        const previstoTotal = previstoTotalByCat[c.id] ?? 0;
        return {
          categoriaId: c.id,
          nombre: c.nombre,
          presupuestoMes: presView(c, mes),
          gastadoMes: (gastadoMesByCat[c.id] ?? 0) + previstoTotal,
          presupuestoAcum,
          gastadoAcum: (gastadoAcumByCat[c.id] ?? 0) + previstoTotal,
          gastosMes: gastosMesByCat[c.id] ?? [],
          previstos: previstosByCat[c.id] ?? [],
        };
      });
  }, [
    categories,
    tramosByCat,
    movements,
    activeRules,
    mes,
    anio,
    startMes,
    rates,
    viewCurrency,
  ]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          presupuestoMes: acc.presupuestoMes + r.presupuestoMes,
          gastadoMes: acc.gastadoMes + r.gastadoMes,
          presupuestoAcum: acc.presupuestoAcum + r.presupuestoAcum,
          gastadoAcum: acc.gastadoAcum + r.gastadoAcum,
        }),
        { presupuestoMes: 0, gastadoMes: 0, presupuestoAcum: 0, gastadoAcum: 0 },
      ),
    [rows],
  );

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const mesNombre = MESES_ES[mes - 1] ?? "";
  const mesInicioNombre = MESES_ES[startMes - 1] ?? "";
  const mesInicioCorto = (MESES_ES_CORTO[startMes - 1] ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Consumo del mes y acumulado del ano por categoria. Los presupuestos
            se definen en Categorias.
          </p>
        </div>
        <div data-tour="presu-periodo">
          <PeriodSelector
            anio={anio}
            mes={mes}
            onChange={({ anio: a, mes: m }) => {
              setAnio(a);
              setMes(m);
            }}
          />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seguimiento {anio}</CardTitle>
          <CardDescription>
            &quot;Este mes&quot; = {mesNombre}. &quot;Acumulado&quot; ={" "}
            {mesInicioNombre} a {mesNombre} ({numMesesAcum}{" "}
            {numMesesAcum === 1 ? "mes" : "meses"})
            {startMes > 1 ? " · desde tu objetivo de ahorro" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-10 text-center">
              <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Ninguna categoria tiene presupuesto definido. Asignalos en
                Categorias.
              </p>
            </div>
          ) : (
            <Table data-tour="presu-consumo">
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Mensual</TableHead>
                  <TableHead className="w-[260px]">Este mes ({mesNombre})</TableHead>
                  <TableHead className="w-[260px]">
                    Acumulado ({mesInicioCorto}-{mesNombre})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const abierta = expandida === r.categoriaId;
                  const numItems = r.gastosMes.length + r.previstos.length;
                  const tieneGastos = numItems > 0;
                  return (
                    <Fragment key={r.categoriaId}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            disabled={!tieneGastos}
                            data-tour={tieneGastos ? "presu-flecha" : undefined}
                            onClick={() =>
                              setExpandida(abierta ? null : r.categoriaId)
                            }
                            className={cn(
                              "flex items-center gap-1.5 text-left",
                              tieneGastos
                                ? "hover:text-primary"
                                : "cursor-default",
                            )}
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                abierta && "rotate-90",
                                !tieneGastos && "opacity-0",
                              )}
                            />
                            <span>{r.nombre}</span>
                            {tieneGastos && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                ({numItems})
                              </span>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(r.presupuestoMes, viewCurrency)}
                        </TableCell>
                        <TableCell>
                          <BudgetCell
                            gastado={r.gastadoMes}
                            presupuesto={r.presupuestoMes}
                            viewCurrency={viewCurrency}
                          />
                        </TableCell>
                        <TableCell>
                          <BudgetCell
                            gastado={r.gastadoAcum}
                            presupuesto={r.presupuestoAcum}
                            viewCurrency={viewCurrency}
                          />
                        </TableCell>
                      </TableRow>
                      {abierta && tieneGastos && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-0">
                            <BudgetBreakdown
                              items={r.gastosMes}
                              previstos={r.previstos}
                              viewCurrency={viewCurrency}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.presupuestoMes, viewCurrency)}
                  </TableCell>
                  <TableCell>
                    <BudgetCell
                      gastado={totals.gastadoMes}
                      presupuesto={totals.presupuestoMes}
                      viewCurrency={viewCurrency}
                    />
                  </TableCell>
                  <TableCell>
                    <BudgetCell
                      gastado={totals.gastadoAcum}
                      presupuesto={totals.presupuestoAcum}
                      viewCurrency={viewCurrency}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BudgetBreakdown({
  items,
  previstos,
  viewCurrency,
}: {
  items: CategoryMovementItem[];
  previstos: PrevistoItem[];
  viewCurrency: string;
}) {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  return (
    <div className="my-2 max-h-72 overflow-y-auto rounded-md border bg-muted/20">
      <table className="w-full text-sm">
        <tbody>
          {items.map(({ movement: m, importeNeto, devuelto, valorVista }) => {
            const fecha = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
            const esDev = m.tipo === "devolucion";
            // Si el gasto esta en otra divisa, mostramos tambien su conversion
            // a la moneda de vista (valorVista ya es el neto convertido).
            const otraDivisa = m.moneda !== viewCurrency;
            return (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="w-[110px] whitespace-nowrap px-3 py-1.5 align-top tabular-nums text-muted-foreground">
                  {formatDateLong(fecha)}
                </td>
                <td className="px-3 py-1.5">
                  {m.concepto}
                  {esDev && (
                    <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      devolución
                    </span>
                  )}
                  {devuelto > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {money(m.importe, m.moneda)} − {money(devuelto, m.moneda)} dev.
                    </div>
                  )}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums",
                    esDev && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  <div>
                    {esDev ? "−" : ""}
                    {money(importeNeto, m.moneda)}
                  </div>
                  {otraDivisa && (
                    <div className="text-xs text-muted-foreground">
                      ≈ {esDev ? "−" : ""}
                      {money(Math.abs(valorVista), viewCurrency)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {previstos.map((p) => {
            const otraDivisa = p.moneda !== viewCurrency;
            return (
              <tr
                key={p.id}
                className="border-b bg-amber-500/5 last:border-b-0"
              >
                <td className="w-[110px] whitespace-nowrap px-3 py-1.5 align-top tabular-nums text-muted-foreground">
                  {formatDateLong(p.fecha)}
                </td>
                <td className="px-3 py-1.5">
                  {p.concepto}
                  <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-500">
                    previsto
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums text-amber-600 dark:text-amber-500">
                  <div>{money(p.importe, p.moneda)}</div>
                  {otraDivisa && (
                    <div className="text-xs text-muted-foreground">
                      ≈ {money(p.valorVista, viewCurrency)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BudgetCell({
  gastado,
  presupuesto,
  viewCurrency,
}: {
  gastado: number;
  presupuesto: number;
  viewCurrency: string;
}) {
  const pct = presupuesto > 0 ? gastado / presupuesto : 0;
  const isOver = pct > 1;
  const isWarning = pct > 0.7 && !isOver;
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span
          className={cn(
            "tabular-nums",
            isOver && "font-semibold text-destructive",
            isWarning && "text-amber-600 dark:text-amber-500",
          )}
        >
          {money(gastado)} / {money(presupuesto)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {(pct * 100).toFixed(0)}%
        </span>
      </div>
      <Progress
        value={Math.min(pct * 100, 100)}
        className={cn(
          isOver && "[&>div]:bg-destructive",
          isWarning && "[&>div]:bg-amber-500",
        )}
      />
    </div>
  );
}
