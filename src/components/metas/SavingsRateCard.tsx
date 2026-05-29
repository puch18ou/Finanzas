"use client";

/**
 * ============================================================================
 *  src/components/metas/SavingsRateCard.tsx — Meta de tasa de ahorro (Lote 14b)
 * ============================================================================
 *
 *  Sigue el objetivo de ahorro mensual, por dos metricas (las dos opcionales):
 *    - Porcentaje de ingresos (settings.objetivoAhorroPct).
 *    - Importe fijo €/mes (settings.objetivoAhorroImporte), en moneda local.
 *
 *  Para cada metrica con objetivo > 0 muestra: el valor de este mes, la media
 *  de los ultimos 12 meses, y una tira de cumplimiento mes a mes. Los importes
 *  y el ahorro se calculan en MONEDA LOCAL.
 * ============================================================================
 */

import { useMemo } from "react";
import Link from "next/link";
import { PiggyBank, Settings as SettingsIcon } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildRatesMap, formatAmount } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type Cell = { label: string; state: "ok" | "bad" | "none"; title: string };

export function SavingsRateCard() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();

  const currentYear = today.getFullYear();
  const { movements: movsThisYear } = useMovements({ anio: currentYear });
  const { movements: movsPrevYear } = useMovements({ anio: currentYear - 1 });

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const monedaLocal = settings?.monedaLocal ?? "EUR";

  const allMovements = useMemo(
    () => [...movsThisYear, ...movsPrevYear],
    [movsThisYear, movsPrevYear],
  );

  const data = useMemo(() => {
    // Ultimos 12 meses (mas antiguo primero).
    const months: { anio: number; mes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, today.getMonth() - i, 1);
      months.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    const summaries = months.map((m) => ({
      ...m,
      ...summarizeMonth({
        mes: m.mes,
        anio: m.anio,
        movements: allMovements,
        rates,
        viewCurrency: monedaLocal,
      }),
    }));

    const conDatos = summaries.filter((s) => s.ingresos > 0 || s.gastos > 0);
    const sumIngresos = conDatos.reduce((a, s) => a + s.ingresos, 0);
    const sumAhorro = conDatos.reduce((a, s) => a + s.ahorro, 0);
    const avgTasa = sumIngresos > 0 ? sumAhorro / sumIngresos : 0;
    const avgImporte = conDatos.length > 0 ? sumAhorro / conDatos.length : 0;

    return { summaries, avgTasa, avgImporte, mesesConDatos: conDatos.length };
  }, [allMovements, rates, monedaLocal, currentYear, today]);

  if (!settings) return null;

  const objetivoPct = settings.objetivoAhorroPct;
  const objetivoImporte = settings.objetivoAhorroImporte;
  const hayObjetivo = objetivoPct > 0 || objetivoImporte > 0;

  const esteMes = data.summaries[data.summaries.length - 1]!;

  const pctCells: Cell[] = data.summaries.map((s) => {
    const tiene = s.ingresos > 0;
    return {
      label: MESES_ES_CORTO[s.mes - 1] ?? "",
      state: !tiene ? "none" : s.tasaAhorro >= objetivoPct ? "ok" : "bad",
      title: tiene
        ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: ${(s.tasaAhorro * 100).toFixed(0)}%`
        : `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin datos`,
    };
  });

  const importeCells: Cell[] = data.summaries.map((s) => {
    const tiene = s.ingresos > 0 || s.gastos > 0;
    return {
      label: MESES_ES_CORTO[s.mes - 1] ?? "",
      state: !tiene ? "none" : s.ahorro >= objetivoImporte ? "ok" : "bad",
      title: tiene
        ? `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: ${formatAmount(s.ahorro, monedaLocal)}`
        : `${MESES_ES_CORTO[s.mes - 1]} ${s.anio}: sin datos`,
    };
  });

  const cumplidosPct = pctCells.filter((c) => c.state === "ok").length;
  const totalPct = pctCells.filter((c) => c.state !== "none").length;
  const cumplidosImp = importeCells.filter((c) => c.state === "ok").length;
  const totalImp = importeCells.filter((c) => c.state !== "none").length;

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
            {monedaLocal}).
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
            {objetivoPct > 0 && (
              <MetricBlock
                titulo="% de ingresos"
                objetivo={`${(objetivoPct * 100).toFixed(0)}%`}
                esteMesTexto={
                  esteMes.ingresos > 0
                    ? `${(esteMes.tasaAhorro * 100).toFixed(0)}%`
                    : "sin datos"
                }
                esteMesOk={esteMes.ingresos > 0 && esteMes.tasaAhorro >= objetivoPct}
                mediaTexto={`${(data.avgTasa * 100).toFixed(0)}%`}
                mediaOk={data.avgTasa >= objetivoPct}
                cumplidos={cumplidosPct}
                total={totalPct}
                cells={pctCells}
              />
            )}
            {objetivoImporte > 0 && (
              <MetricBlock
                titulo={`Importe (${monedaLocal}/mes)`}
                objetivo={formatAmount(objetivoImporte, monedaLocal)}
                esteMesTexto={
                  esteMes.ingresos > 0 || esteMes.gastos > 0
                    ? formatAmount(esteMes.ahorro, monedaLocal)
                    : "sin datos"
                }
                esteMesOk={
                  (esteMes.ingresos > 0 || esteMes.gastos > 0) &&
                  esteMes.ahorro >= objetivoImporte
                }
                mediaTexto={formatAmount(data.avgImporte, monedaLocal)}
                mediaOk={data.avgImporte >= objetivoImporte}
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
