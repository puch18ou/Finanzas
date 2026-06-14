"use client";

/**
 * src/components/ajustes/HealthCard.tsx
 *
 * Tarjeta de SALUD de los datos automaticos: hace cuanto se actualizaron las
 * cotizaciones, los tipos de cambio y la ultima sincronizacion. Los proveedores
 * externos (Yahoo, BCE) fallan en silencio; esto lo hace visible de un vistazo.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useInvestments } from "@/hooks/useInvestments";
import { useCurrencies } from "@/hooks/useSettings";
import { useRepos } from "@/contexts/DatabaseProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { timeAgo, stalenessLevel, type StalenessLevel } from "@/lib/utils/staleness";
import { cn } from "@/lib/utils/cn";

const DOT: Record<StalenessLevel, string> = {
  fresh: "bg-emerald-500",
  warn: "bg-amber-500",
  stale: "bg-red-500",
  never: "bg-muted-foreground",
};

function maxDate(dates: Array<Date | null | undefined>): Date | null {
  let max: Date | null = null;
  for (const d of dates) {
    if (d && (!max || d.getTime() > max.getTime())) max = d;
  }
  return max;
}

export function HealthCard() {
  const { investments } = useInvestments();
  const { data: currencies = [] } = useCurrencies();
  const repos = useRepos();

  const { data: syncStates = [] } = useQuery({
    queryKey: ["syncState", "health"],
    queryFn: () => repos.syncState.list(),
  });

  // Cotizaciones: la posicion cotizable (con ticker) MAS antigua manda. Si
  // alguna nunca se actualizo, se considera "nunca".
  const cotizables = useMemo(
    () =>
      investments.filter(
        (i) => !!i.ticker && i.ticker.trim() !== "" && i.tipo !== "Cuenta remunerada",
      ),
    [investments],
  );
  const cotizacionVieja = useMemo(() => {
    if (cotizables.length === 0) return undefined; // no aplica
    if (cotizables.some((i) => !i.ultimaActualizacionPrecio)) return null; // nunca
    let min: Date | null = null;
    for (const i of cotizables) {
      const d = i.ultimaActualizacionPrecio!;
      if (!min || d.getTime() < min.getTime()) min = d;
    }
    return min;
  }, [cotizables]);

  const fxUpdated = useMemo(
    () => maxDate(currencies.map((c) => c.updatedAt)),
    [currencies],
  );

  const lastSync = useMemo(
    () => maxDate(syncStates.map((s) => s.lastSyncAt)),
    [syncStates],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Salud de los datos
        </CardTitle>
        <CardDescription>
          Cuando se actualizaron por ultima vez los datos automaticos. Si algo
          esta viejo (ambar/rojo), usa el boton de actualizar correspondiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <HealthRow
          label="Cotizaciones"
          date={cotizacionVieja}
          notApplicable={cotizables.length === 0}
          notApplicableText="Sin posiciones cotizables"
          warnDays={3}
          staleDays={8}
        />
        <HealthRow
          label="Tipos de cambio"
          date={fxUpdated}
          warnDays={4}
          staleDays={10}
        />
        <HealthRow
          label="Ultima sincronizacion"
          date={lastSync}
          neverText="Sin sincronizar"
          warnDays={2}
          staleDays={10}
        />
      </CardContent>
    </Card>
  );
}

function HealthRow({
  label,
  date,
  warnDays,
  staleDays,
  notApplicable = false,
  notApplicableText = "No aplica",
  neverText = "Nunca",
}: {
  label: string;
  date: Date | null | undefined;
  warnDays: number;
  staleDays: number;
  notApplicable?: boolean;
  notApplicableText?: string;
  neverText?: string;
}) {
  const level = stalenessLevel(date ?? null, { warnDays, staleDays });
  const text = notApplicable
    ? notApplicableText
    : level === "never"
      ? neverText
      : timeAgo(date);

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {!notApplicable && (
          <span className={cn("h-2 w-2 rounded-full", DOT[level])} />
        )}
        <span className="tabular-nums">{text}</span>
      </span>
    </div>
  );
}
