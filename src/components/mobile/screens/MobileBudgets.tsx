"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import {
  sumMovementsByCategory,
  listMovementsByCategory,
} from "@/lib/domain/aggregation";
import { monthlyOccurrenceFor } from "@/lib/domain/recurring";
import { resolvePresupuesto } from "@/lib/domain/tramos";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "@/components/ui/card";

export function MobileBudgets() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { tramos } = usePresupuestoTramos();
  const { data: activeRules = [] } = useActiveRecurringRules();

  const view = settings?.monedaVista ?? "EUR";
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  const { movements } = useMovements({ anio, mes });

  const [expandida, setExpandida] = useState<string | null>(null);

  const rates = buildRatesMap(currencies);
  const gastoPorCat = sumMovementsByCategory(movements, rates, view);
  // Desglose real (gastos/devoluciones registrados) por categoria, para
  // desplegar cada presupuesto. No incluye los previstos que se suman abajo.
  const gastosPorCat = listMovementsByCategory(movements, rates, view);

  // Sumamos tambien los gastos PREVISTOS del mes (recurrentes que aun no han
  // ocurrido), por categoria, para que el consumo refleje lo que falta por
  // pagar. Solo si el mes mostrado es el actual.
  const isCurrentMonth = anio === now.getFullYear() && mes === now.getMonth() + 1;
  if (isCurrentMonth) {
    const nowMs = now.getTime();
    for (const rule of activeRules) {
      if (rule.origenAutomatico === "investment") continue;
      const esGasto =
        rule.tipoMovimiento === "gasto" || rule.tipoMovimiento === "cuota";
      if (!esGasto || !rule.categoriaId) continue;
      const occ = monthlyOccurrenceFor(rule, anio, mes);
      if (!occ || occ.getTime() <= nowMs) continue;
      try {
        const importe = convert(rule.importe, rule.moneda, view, rates);
        gastoPorCat[rule.categoriaId] =
          (gastoPorCat[rule.categoriaId] ?? 0) + importe;
      } catch {
        // moneda sin tipo de cambio, ignorar
      }
    }
  }

  const filas = categories
    .filter((c) => !c.deletedAt)
    .map((c) => {
      const catTramos = tramos.filter((t) => t.categoriaId === c.id);
      const { importe, moneda } = resolvePresupuesto(
        catTramos,
        c.presupuestoMensual,
        c.presupuestoMoneda,
        anio,
        mes,
      );
      const presupuesto = convert(importe, moneda, view, rates);
      const gastado = gastoPorCat[c.id] ?? 0;
      return {
        id: c.id,
        nombre: c.nombre,
        presupuesto,
        gastado,
        gastos: gastosPorCat[c.id] ?? [],
      };
    })
    .filter((f) => f.presupuesto > 0)
    .sort((a, b) => b.gastado / b.presupuesto - a.gastado / a.presupuesto);

  return (
    <MobileScreen title="Presupuestos">
      <p className="-mt-1 text-sm text-muted-foreground">Consumo de este mes</p>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay categorias con presupuesto.
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map((f) => {
            const pct = Math.min(100, (f.gastado / f.presupuesto) * 100);
            const over = f.gastado > f.presupuesto;
            const abierta = expandida === f.id;
            const tieneGastos = f.gastos.length > 0;
            return (
              <Card key={f.id}>
                <CardContent className="space-y-1.5 py-3">
                  <button
                    type="button"
                    disabled={!tieneGastos}
                    onClick={() => setExpandida(abierta ? null : f.id)}
                    className="flex w-full items-baseline justify-between gap-2 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
                      {tieneGastos && (
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                            abierta && "rotate-90",
                          )}
                        />
                      )}
                      <span className="truncate">{f.nombre}</span>
                      {tieneGastos && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          ({f.gastos.length})
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${over ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                    >
                      {formatMoney(f.gastado, view)} / {formatMoney(f.presupuesto, view)}
                    </span>
                  </button>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${over ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {abierta && tieneGastos && (
                    <div className="mt-1 max-h-56 divide-y divide-border/60 overflow-y-auto rounded-md border bg-muted/20">
                      {f.gastos.map(
                        ({ movement: m, importeNeto, devuelto, valorVista }) => {
                          const esDev = m.tipo === "devolucion";
                          const otraDivisa = m.moneda !== view;
                          return (
                            <div
                              key={m.id}
                              className="flex items-baseline justify-between gap-2 px-2.5 py-1.5 text-xs"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">
                                  {m.concepto}
                                </span>
                                {devuelto > 0 && (
                                  <span className="block text-[10px] text-muted-foreground">
                                    {formatAmount(m.importe, m.moneda)} −{" "}
                                    {formatAmount(devuelto, m.moneda)} dev.
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-right">
                                <span
                                  className={cn(
                                    "block tabular-nums text-muted-foreground",
                                    esDev &&
                                      "text-emerald-600 dark:text-emerald-400",
                                  )}
                                >
                                  {esDev ? "−" : ""}
                                  {formatAmount(importeNeto, m.moneda)}
                                </span>
                                {otraDivisa && (
                                  <span className="block text-[10px] text-muted-foreground">
                                    ≈ {esDev ? "−" : ""}
                                    {formatAmount(Math.abs(valorVista), view)}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </MobileScreen>
  );
}
