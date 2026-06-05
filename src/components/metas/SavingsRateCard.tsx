"use client";

/**
 * ============================================================================
 *  src/components/metas/SavingsRateCard.tsx — Meta de tasa de ahorro
 * ============================================================================
 *
 *  Sigue el objetivo de ahorro mensual (% de ingresos y/o importe fijo/mes),
 *  que ahora vive como TRAMOS con vigencia (ver Ajustes). Para cada mes se
 *  resuelve el tramo vigente y se compara con el ahorro de ese mes.
 *
 *  Los importes y el ahorro se calculan en MONEDA LOCAL.
 * ============================================================================
 */

import { useMemo } from "react";
import Link from "next/link";
import { PiggyBank, Settings as SettingsIcon } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useObjetivoTramos } from "@/hooks/useObjetivoTramos";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { resolveTramo, tramosAncla } from "@/lib/domain/tramos";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type Cell = { label: string; state: "ok" | "bad" | "none"; title: string };

export function SavingsRateCard() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { tramos } = useObjetivoTramos();

  const currentYear = today.getFullYear();
  const { movements: movsThisYear } = useMovements({ anio: currentYear });
  const { movements: movsPrevYear } = useMovements({ anio: currentYear - 1 });

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const monedaLocal = settings?.monedaLocal ?? "EUR";

  const allMovements = useMemo(
    () => [...movsThisYear, ...movsPrevYear],
    [movsThisYear, movsPrevYear],
  );

  // Ultimos 12 meses (mas antiguo primero) con su resumen en moneda local.
  const summaries = useMemo(() => {
    const months: { anio: number; mes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, today.getMonth() - i, 1);
      months.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
    }
    return months.map((m) => ({
      ...m,
      ...summarizeMonth({
        mes: m.mes,
        anio: m.anio,
        movements: allMovements,
        rates,
        viewCurrency: monedaLocal,
      }),
    }));
  }, [allMovements, rates, monedaLocal, currentYear, today]);

  if (!settings) return null;

  // Importe del objetivo (de un tramo) convertido a moneda local.
  const importeLocal = (amount: number, moneda: string) => {
    if (amount <= 0) return 0;
    try {
      return convert(amount, moneda, monedaLocal, rates);
    } catch {
      return 0;
    }
  };

  const objetivoPctMes = (anio: number, mes: number) =>
    resolveTramo(tramos, anio, mes)?.pct ?? 0;
  const objetivoImporteMes = (anio: number, mes: number) => {
    const tr = resolveTramo(tramos, anio, mes);
    return tr ? importeLocal(tr.importe, tr.moneda) : 0;
  };

  const hayPctEnAlgunTramo = tramos.some((t) => t.pct > 0);
  const hayImporteEnAlgunTramo = tramos.some((t) => t.importe > 0);
  const hayObjetivo = hayPctEnAlgunTramo || hayImporteEnAlgunTramo;

  // Objetivo vigente este mes (para los textos de cabecera y "este mes").
  const esteMes = summaries[summaries.length - 1]!;
  const objetivoPctVigente = objetivoPctMes(esteMes.anio, esteMes.mes);
  const objetivoImporteVigente = objetivoImporteMes(esteMes.anio, esteMes.mes);

  // Tira de cumplimiento por % de ingresos.
  const pctCells: Cell[] = summaries.map((s) => {
    const obj = objetivoPctMes(s.anio, s.mes);
    const tiene = s.ingresos > 0;
    const efectivo = obj > 0;
    return {
      label: MESES_ES_CORTO[s.mes - 1] ?? "",
      state:
        !efectivo || !tiene ? "none" : s.tasaAhorro >= obj ? "ok" : "bad",
      title: !efectivo
        ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin objetivo`
        : tiene
          ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: ${(s.tasaAhorro * 100).toFixed(0)}% (obj. ${(obj * 100).toFixed(0)}%)`
          : `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin datos`,
    };
  });

  // Tira de cumplimiento por importe.
  const importeCells: Cell[] = summaries.map((s) => {
    const obj = objetivoImporteMes(s.anio, s.mes);
    const tiene = s.ingresos > 0 || s.gastos > 0;
    const efectivo = obj > 0;
    return {
      label: MESES_ES_CORTO[s.mes - 1] ?? "",
      state: !efectivo || !tiene ? "none" : s.ahorro >= obj ? "ok" : "bad",
      title: !efectivo
        ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin objetivo`
        : tiene
          ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: ${formatAmount(s.ahorro, monedaLocal)} (obj. ${formatAmount(obj, monedaLocal)})`
          : `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin datos`,
    };
  });

  // Medias sobre los meses CON DATOS y con objetivo vigente (efectivos).
  const pctMonths = summaries.filter(
    (s) => s.ingresos > 0 && objetivoPctMes(s.anio, s.mes) > 0,
  );
  const sumIngresosPct = pctMonths.reduce((a, s) => a + s.ingresos, 0);
  const sumAhorroPct = pctMonths.reduce((a, s) => a + s.ahorro, 0);
  const avgTasa = sumIngresosPct > 0 ? sumAhorroPct / sumIngresosPct : 0;

  const impMonths = summaries.filter(
    (s) =>
      (s.ingresos > 0 || s.gastos > 0) && objetivoImporteMes(s.anio, s.mes) > 0,
  );
  const avgImporte =
    impMonths.length > 0
      ? impMonths.reduce((a, s) => a + s.ahorro, 0) / impMonths.length
      : 0;

  const cumplidosPct = pctCells.filter((c) => c.state === "ok").length;
  const totalPct = pctCells.filter((c) => c.state !== "none").length;
  const cumplidosImp = importeCells.filter((c) => c.state === "ok").length;
  const totalImp = importeCells.filter((c) => c.state !== "none").length;

  const esteMesPctOk =
    objetivoPctVigente > 0 &&
    esteMes.ingresos > 0 &&
    esteMes.tasaAhorro >= objetivoPctVigente;
  const esteMesImpOk =
    objetivoImporteVigente > 0 &&
    (esteMes.ingresos > 0 || esteMes.gastos > 0) &&
    esteMes.ahorro >= objetivoImporteVigente;

  const ancla = tramosAncla(tramos);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Tasa de ahorro
          </CardTitle>
          <CardDescription>
            Objetivo de ahorro mensual y su cumplimiento (ultimos 12 meses, en{" "}
            {monedaLocal})
            {ancla
              ? `. Efectivo desde ${MESES_ES_CORTO[ancla.mes - 1]} ${ancla.anio}.`
              : "."}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/ajustes">
            <SettingsIcon className="mr-1 h-4 w-4" />
            Objetivo
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hayObjetivo ? (
          <p className="text-sm text-muted-foreground">
            No tienes objetivo de ahorro. Define un porcentaje o un importe en{" "}
            <Link href="/ajustes" className="underline">
              Ajustes
            </Link>
            .
          </p>
        ) : (
          <>
            {hayPctEnAlgunTramo && (
              <MetricBlock
                titulo="% de ingresos"
                objetivo={
                  objetivoPctVigente > 0
                    ? `${(objetivoPctVigente * 100).toFixed(0)}%`
                    : "sin objetivo este mes"
                }
                esteMesTexto={
                  objetivoPctVigente <= 0
                    ? "no efectivo"
                    : esteMes.ingresos > 0
                      ? `${(esteMes.tasaAhorro * 100).toFixed(0)}%`
                      : "sin datos"
                }
                esteMesOk={esteMesPctOk}
                mediaTexto={`${(avgTasa * 100).toFixed(0)}%`}
                mediaOk={objetivoPctVigente > 0 && avgTasa >= objetivoPctVigente}
                cumplidos={cumplidosPct}
                total={totalPct}
                cells={pctCells}
              />
            )}
            {hayImporteEnAlgunTramo && (
              <MetricBlock
                titulo={`Importe (${monedaLocal}/mes)`}
                objetivo={
                  objetivoImporteVigente > 0
                    ? formatAmount(objetivoImporteVigente, monedaLocal)
                    : "sin objetivo este mes"
                }
                esteMesTexto={
                  objetivoImporteVigente <= 0
                    ? "no efectivo"
                    : esteMes.ingresos > 0 || esteMes.gastos > 0
                      ? formatAmount(esteMes.ahorro, monedaLocal)
                      : "sin datos"
                }
                esteMesOk={esteMesImpOk}
                mediaTexto={formatAmount(avgImporte, monedaLocal)}
                mediaOk={
                  objetivoImporteVigente > 0 && avgImporte >= objetivoImporteVigente
                }
                cumplidos={cumplidosImp}
                total={totalImp}
                cells={importeCells}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBlock({
  titulo,
  objetivo,
  esteMesTexto,
  esteMesOk,
  mediaTexto,
  mediaOk,
  cumplidos,
  total,
  cells,
}: {
  titulo: string;
  objetivo: string;
  esteMesTexto: string;
  esteMesOk: boolean;
  mediaTexto: string;
  mediaOk: boolean;
  cumplidos: number;
  total: number;
  cells: Cell[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="text-xs text-muted-foreground">
          Objetivo: {objetivo}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-xs text-muted-foreground">Este mes</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              esteMesOk ? "text-primary" : "text-foreground",
            )}
          >
            {esteMesTexto} {esteMesOk ? "✓" : ""}
          </p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-xs text-muted-foreground">Media 12 meses</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              mediaOk ? "text-primary" : "text-destructive",
            )}
          >
            {mediaTexto} {mediaOk ? "✓" : "✗"}
          </p>
        </div>
      </div>
      <div>
        <div className="flex items-end gap-1">
          {cells.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                title={c.title}
                className={cn(
                  "h-6 w-full rounded-sm",
                  c.state === "ok" && "bg-primary",
                  c.state === "bad" && "bg-destructive/70",
                  c.state === "none" && "bg-muted",
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                {c.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          Cumplido {cumplidos}/{total} meses
        </p>
      </div>
    </div>
  );
}
