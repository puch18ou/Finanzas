"use client";

/**
 * src/components/dashboard/AlertsCard.tsx
 *
 * Avisos accionables (insight A). De momento, presupuestos por categoria: te
 * has pasado (rojo) o casi lo agotas (ambar). Si no hay avisos, no pinta nada
 * (para no meter ruido cuando todo va bien). Ver domain/alerts.
 */

import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeBudgetAlerts, type BudgetInput } from "@/lib/domain/alerts";
import { formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { cn } from "@/lib/utils/cn";

export function AlertsCard({
  rows,
  viewCurrency,
  dataTour,
}: {
  rows: BudgetInput[];
  viewCurrency: string;
  dataTour?: string;
}) {
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));
  const alerts = computeBudgetAlerts(rows);
  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-500/40" data-tour={dataTour}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Avisos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => {
          const pct = Math.round(a.ratio * 100);
          const over = a.severity === "high";
          return (
            <div
              key={a.categoriaId}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    over ? "bg-red-500" : "bg-amber-500",
                  )}
                />
                <span>
                  {over ? "Te has pasado en " : "Casi agotas "}
                  <strong>{a.nombre}</strong>
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  over ? "text-destructive" : "text-amber-600 dark:text-amber-500",
                )}
              >
                {money(a.gastado)} / {money(a.presupuesto)} ({pct}%)
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
