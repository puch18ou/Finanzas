"use client";

import { MobileScreen } from "../MobileScreen";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { useMovements } from "@/hooks/useMovements";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { sumMovementsByCategory } from "@/lib/domain/aggregation";
import { monthlyOccurrenceFor } from "@/lib/domain/recurring";
import { resolvePresupuesto } from "@/lib/domain/tramos";
import { formatMoney } from "@/lib/utils/money";
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

  const rates = buildRatesMap(currencies);
  const gastoPorCat = sumMovementsByCategory(movements, rates, view);

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
      return { id: c.id, nombre: c.nombre, presupuesto, gastado };
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
            return (
              <Card key={f.id}>
                <CardContent className="space-y-1.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{f.nombre}</span>
                    <span
                      className={`shrink-0 text-xs ${over ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                    >
                      {formatMoney(f.gastado, view)} / {formatMoney(f.presupuesto, view)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${over ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </MobileScreen>
  );
}
