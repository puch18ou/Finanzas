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

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useMovements } from "@/hooks/useMovements";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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
} from "@/lib/domain/aggregation";
import { MESES_ES } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type Row = {
  categoriaId: string;
  nombre: string;
  presupuestoMes: number;
  gastadoMes: number;
  presupuestoAcum: number;
  gastadoAcum: number;
};

export default function PresupuestosPage() {
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();

  const [anio, setAnio] = useLocalStorage<number>(
    "presup:anio",
    today.getFullYear(),
  );
  const [mes, setMes] = useLocalStorage<number>(
    "presup:mes",
    today.getMonth() + 1,
  );

  const { movements } = useMovements({ anio });

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  const rows: Row[] = useMemo(() => {
    // Gasto del mes de referencia y gasto acumulado (enero..mes), por categoria.
    const movsMes = filterMovementsByPeriod(movements, mes, anio);
    const movsAcum = movements.filter((m) => m.anio === anio && m.mes <= mes);
    const gastadoMesByCat = sumMovementsByCategory(movsMes, rates, viewCurrency);
    const gastadoAcumByCat = sumMovementsByCategory(
      movsAcum,
      rates,
      viewCurrency,
    );

    return categories
      .filter((c) => c.presupuestoMensual > 0)
      .map((c) => {
        let presView = 0;
        try {
          presView = convert(
            c.presupuestoMensual,
            c.presupuestoMoneda,
            viewCurrency,
            rates,
          );
        } catch {
          presView = 0;
        }
        return {
          categoriaId: c.id,
          nombre: c.nombre,
          presupuestoMes: presView,
          gastadoMes: gastadoMesByCat[c.id] ?? 0,
          presupuestoAcum: presView * mes,
          gastadoAcum: gastadoAcumByCat[c.id] ?? 0,
        };
      });
  }, [categories, movements, mes, anio, rates, viewCurrency]);

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
        <PeriodSelector
          anio={anio}
          mes={mes}
          onChange={({ anio: a, mes: m }) => {
            setAnio(a);
            setMes(m);
          }}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seguimiento {anio}</CardTitle>
          <CardDescription>
            &quot;Este mes&quot; = {mesNombre}. &quot;Acumulado&quot; = enero a{" "}
            {mesNombre} ({mes} {mes === 1 ? "mes" : "meses"}).
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Mensual</TableHead>
                  <TableHead className="w-[260px]">Este mes ({mesNombre})</TableHead>
                  <TableHead className="w-[260px]">
                    Acumulado (ene-{mesNombre})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.categoriaId}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(r.presupuestoMes, viewCurrency)}
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
                ))}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(totals.presupuestoMes, viewCurrency)}
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
          {formatAmount(gastado, viewCurrency)} /{" "}
          {formatAmount(presupuesto, viewCurrency)}
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
