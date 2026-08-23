"use client";

/**
 * src/components/dashboard/BudgetProgress.tsx
 *
 * Tarjeta con una lista de categorias mostrando su consumo vs presupuesto.
 * Para cada categoria con presupuesto > 0 muestra:
 *   - Nombre
 *   - Importe gastado / presupuesto
 *   - Barra de progreso con color segun porcentaje
 *
 *  < 70%: verde
 *  70-100%: amarillo
 *  > 100%: rojo
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";

export type BudgetRow = {
  categoriaId: string;
  nombre: string;
  gastado: number;
  presupuesto: number;
};

type Props = {
  rows: BudgetRow[];
  viewCurrency: string;
  dataTour?: string;
};

export function BudgetProgress({ rows, viewCurrency, dataTour }: Props) {
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));
  // Solo mostramos categorias con presupuesto > 0 (las que no tienen
  // limite serian engorrosas en esta vista).
  const filtered = rows.filter((r) => r.presupuesto > 0);

  return (
    <Card data-tour={dataTour}>
      <CardHeader>
        <CardTitle>Presupuesto del mes</CardTitle>
        <CardDescription>
          Consumo del mes activo respecto al presupuesto por categoria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay categorias con presupuesto definido.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r) => {
              const pct = r.presupuesto > 0 ? r.gastado / r.presupuesto : 0;
              const pctClamped = Math.min(pct * 100, 100);
              const isOver = pct > 1;
              const isWarning = pct > 0.7 && !isOver;

              return (
                <div key={r.categoriaId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{r.nombre}</span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-xs tabular-nums text-muted-foreground",
                        isOver && "font-semibold text-destructive",
                        isWarning && "text-amber-600 dark:text-amber-500",
                      )}
                    >
                      {money(r.gastado)} / {money(r.presupuesto)} ·{" "}
                      {(pct * 100).toFixed(0)}%{isOver && " ⚠"}
                    </span>
                  </div>
                  <Progress
                    value={pctClamped}
                    className={cn(
                      "h-1.5",
                      isOver && "[&>div]:bg-destructive",
                      isWarning && "[&>div]:bg-amber-500",
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
