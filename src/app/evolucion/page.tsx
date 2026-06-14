"use client";

/**
 * src/app/evolucion/page.tsx — Evolucion anual (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { monthlyOccurrenceFor } from "@/lib/domain/recurring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvolutionChart } from "@/components/charts/EvolutionChart";
import { PatrimonioChart } from "@/components/charts/PatrimonioChart";
import { usePatrimonioSnapshots } from "@/hooks/usePatrimonioSnapshots";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { useObjetivoTramos } from "@/hooks/useObjetivoTramos";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { tramosAncla } from "@/lib/domain/tramos";
import { cn } from "@/lib/utils/cn";

const MESES_LABEL = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export default function EvolucionPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { tramos: objetivoTramos } = useObjetivoTramos();
  const { tramos: presupuestoTramos } = usePresupuestoTramos();

  const [anio, setAnio] = useLocalStorage<number>(
    "evolucion:anio",
    today.getFullYear(),
  );
  // Modo del selector: por anio natural, o "desde el objetivo de ahorro"
  // (un mes por fila desde la fecha del objetivo hasta el mes actual).
  const [modo, setModo] = useLocalStorage<"anio" | "objetivo">(
    "evolucion:modo",
    "anio",
  );

  // Ancla = primer mes del objetivo de ahorro (primer tramo). Null si el
  // objetivo es "desde siempre" o no hay objetivo: en ese caso no ofrecemos
  // el modo "desde objetivo".
  const ancla = tramosAncla(objetivoTramos);
  const anclaAnio = ancla?.anio ?? null;
  const anclaMes = ancla?.mes ?? null;
  const hayObjetivoDesde = ancla != null;
  const usaObjetivo = modo === "objetivo" && ancla != null;

  // Lista de periodos (anio+mes) a mostrar, mas antiguo primero.
  const periodos = useMemo<{ anio: number; mes: number }[]>(() => {
    if (usaObjetivo && anclaAnio != null && anclaMes != null) {
      const now = new Date();
      const endKey = now.getFullYear() * 100 + (now.getMonth() + 1);
      const list: { anio: number; mes: number }[] = [];
      let y = anclaAnio;
      let m = anclaMes;
      while (y * 100 + m <= endKey) {
        list.push({ anio: y, mes: m });
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
        if (list.length > 600) break; // backstop defensivo
      }
      if (list.length === 0) {
        list.push({ anio: anclaAnio, mes: anclaMes });
      }
      return list;
    }
    return Array.from({ length: 12 }, (_, i) => ({ anio, mes: i + 1 }));
  }, [usaObjetivo, anclaAnio, anclaMes, anio]);

  const multiAnio = useMemo(
    () => new Set(periodos.map((p) => p.anio)).size > 1,
    [periodos],
  );

  // Meses con un cambio de tramo (objetivo y/o presupuesto). Clave anio*100+mes
  // -> texto del tipo de cambio.
  const cambios = useMemo(() => {
    const map = new Map<number, Set<string>>();
    const add = (
      a: number | null,
      m: number | null,
      etiqueta: string,
    ) => {
      if (a == null || m == null) return;
      const k = a * 100 + m;
      (map.get(k) ?? map.set(k, new Set()).get(k)!).add(etiqueta);
    };
    for (const t of objetivoTramos) add(t.desdeAnio, t.desdeMes, "objetivo");
    for (const t of presupuestoTramos)
      add(t.desdeAnio, t.desdeMes, "presupuesto");
    return map;
  }, [objetivoTramos, presupuestoTramos]);

  const cambioTitulo = (anio: number, mes: number): string | null => {
    const tipos = cambios.get(anio * 100 + mes);
    if (!tipos || tipos.size === 0) return null;
    return `Cambio de ${[...tipos].join(" y ")}`;
  };

  // Filtro de carga: en modo objetivo cargamos el rango completo de anios.
  const movementsFilter = useMemo(() => {
    if (usaObjetivo && anclaAnio != null) {
      return {
        anioDesde: anclaAnio,
        anioHasta: new Date().getFullYear(),
      };
    }
    return { anio };
  }, [usaObjetivo, anclaAnio, anio]);

  const { movements } = useMovements(movementsFilter);
  const { data: activeRules = [] } = useActiveRecurringRules();
  const { snapshots } = usePatrimonioSnapshots();

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Previstos del mes ACTUAL real (no en meses futuros, donde no tiene
  // sentido contar como movimiento del mes algo aun por venir). Se calculan
  // para el mes/anio real del sistema y solo se aplican a ese periodo.
  const previstosActual = useMemo(() => {
    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActual = now.getMonth() + 1;
    const zero = { anio: anioActual, mes: mesActual, ingresos: 0, gastos: 0 };
    if (!settings) return zero;
    const nowMs = now.getTime();
    let ingresos = 0;
    let gastos = 0;
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      const esIngreso =
        rule.tipoMovimiento === "ingreso" ||
        rule.tipoMovimiento === "intereses";
      const esGasto =
        rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
      if (!esIngreso && !esGasto) continue;
      const occ = monthlyOccurrenceFor(rule, anioActual, mesActual);
      if (!occ) continue;
      if (occ.getTime() <= nowMs) continue;
      try {
        const importe = convert(rule.importe, rule.moneda, viewCurrency, rates);
        if (esIngreso) ingresos += importe;
        else gastos += importe;
      } catch {
        // ignorar moneda no encontrada
      }
    }
    return { anio: anioActual, mes: mesActual, ingresos, gastos };
  }, [settings, activeRules, rates, viewCurrency]);

  const monthlyData = useMemo(() => {
    if (!settings) return [];
    return periodos.map((p) => {
      const base = summarizeMonth({
        mes: p.mes,
        anio: p.anio,
        movements,
        rates,
        viewCurrency,
      });
      const isCurrent =
        p.anio === previstosActual.anio && p.mes === previstosActual.mes;
      const ingresoPrevisto = isCurrent ? previstosActual.ingresos : 0;
      const gastoPrevisto = isCurrent ? previstosActual.gastos : 0;
      const ingresos = base.ingresos + ingresoPrevisto;
      const gastos = base.gastos + gastoPrevisto;
      const ahorro = ingresos - gastos;
      const tasaAhorro = ingresos > 0 ? ahorro / ingresos : 0;
      const label = multiAnio
        ? `${MESES_LABEL[p.mes - 1]} ${String(p.anio).slice(2)}`
        : MESES_LABEL[p.mes - 1];
      return {
        anio: p.anio,
        mes: p.mes,
        ...base,
        ingresos,
        gastos,
        ahorro,
        tasaAhorro,
        ingresoPrevisto,
        gastoPrevisto,
        label,
      };
    });
  }, [settings, periodos, multiAnio, movements, rates, viewCurrency, previstosActual]);

  const yearTotals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const r of monthlyData) {
      ingresos += r.ingresos;
      gastos += r.gastos;
    }
    const ahorro = ingresos - gastos;
    const tasa = ingresos > 0 ? ahorro / ingresos : 0;
    return { ingresos, gastos, ahorro, tasa };
  }, [monthlyData]);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evolucion</h1>
          <p className="text-sm text-muted-foreground">
            {usaObjetivo
              ? "Resumen mensual desde tu objetivo de ahorro."
              : "Resumen mensual del anio seleccionado."}
          </p>
        </div>
        <Select
          value={usaObjetivo ? "objetivo" : String(anio)}
          onValueChange={(v) => {
            if (v === "objetivo") {
              setModo("objetivo");
            } else {
              setModo("anio");
              setAnio(Number(v));
            }
          }}
        >
          <SelectTrigger className={hayObjetivoDesde ? "w-[210px]" : "w-[120px]"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hayObjetivoDesde && (
              <SelectItem value="objetivo">
                Desde objetivo de ahorro
              </SelectItem>
            )}
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {usaObjetivo ? "Resumen desde objetivo" : `Resumen ${anio}`}
          </CardTitle>
          <CardDescription>
            {usaObjetivo
              ? `Totales del periodo en ${viewCurrency}`
              : `Totales anuales en ${viewCurrency}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <YearTotal label="Ingresos" value={formatAmount(yearTotals.ingresos, viewCurrency)} intent="positive" />
          <YearTotal label="Gastos" value={formatAmount(yearTotals.gastos, viewCurrency)} intent="negative" />
          <YearTotal
            label="Ahorro"
            value={formatAmount(yearTotals.ahorro, viewCurrency)}
            intent={yearTotals.ahorro >= 0 ? "positive" : "negative"}
          />
          <YearTotal
            label="Tasa media"
            value={`${(yearTotals.tasa * 100).toFixed(0)}%`}
          />
        </CardContent>
      </Card>

      <EvolutionChart
        data={monthlyData}
        viewCurrency={viewCurrency}
        title="Mes a mes"
        description={`Ingresos vs gastos en ${viewCurrency}`}
        markers={monthlyData
          .filter((r) => cambios.has(r.anio * 100 + r.mes))
          .map((r) => ({
            label: r.label ?? "",
            title: cambioTitulo(r.anio, r.mes) ?? undefined,
          }))}
      />

      <PatrimonioChart snapshots={snapshots} />

      <Card>
        <CardHeader>
          <CardTitle>Detalle por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Mes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Ahorro</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((r) => {
                const cambio = cambioTitulo(r.anio, r.mes);
                return (
                <TableRow key={`${r.anio}-${r.mes}`}>
                  <TableCell className="font-medium">
                    {r.label}
                    {cambio && (
                      <span
                        className="ml-1 text-xs text-muted-foreground"
                        title={cambio}
                      >
                        ⏱
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-primary">
                    {formatAmount(r.ingresos, viewCurrency)}
                    {r.ingresoPrevisto > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        +{formatAmount(r.ingresoPrevisto, viewCurrency)} previsto
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {formatAmount(r.gastos, viewCurrency)}
                    {r.gastoPrevisto > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        +{formatAmount(r.gastoPrevisto, viewCurrency)} previsto
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      r.ahorro >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {formatAmount(r.ahorro, viewCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.ingresos > 0 ? `${(r.tasaAhorro * 100).toFixed(0)}%` : "—"}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function YearTotal({
  label,
  value,
  intent = "neutral",
}: {
  label: string;
  value: string;
  intent?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          intent === "positive" && "text-primary",
          intent === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
