"use client";

import { MobileScreen } from "../MobileScreen";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { usePresupuestoTramos } from "@/hooks/usePresupuestoTramos";
import { useMovements } from "@/hooks/useMovements";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { sumMovementsByCategory } from "@/lib/domain/aggregation";
import { resolvePresupuesto } from "@/lib/domain/tramos";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";

export function MobileBudgets() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { tramos } = usePresupuestoTramos();

  const view = settings?.monedaVista ?? "EUR";
  const now = new Date();
  const mes = settings?.mesActual ?? now.getMonth() + 1;
  const anio = settings?.anioActual ?? now.getFullYear();
  const { movements } = useMovements({ anio, mes });

  const rates = buildRatesMap(currencies);
  const gastoPorCat = sumMovementsByCategory(movements, rates, view);

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
